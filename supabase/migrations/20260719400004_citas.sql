-- ============================================================================
-- Fase 5 — Citas: núcleo de agenda con anti-traslape en la base
-- ============================================================================
-- Las citas NUNCA se borran físicamente: son registro operativo/clínico.
-- Cancelación y no-show son estados terminales; el historial de estados es
-- append-only. El folio es secuencial por clínica y año (tabla de contadores
-- con UPSERT atómico; jamás COUNT(*)+1).
-- ============================================================================

create table public.appointment_folio_counters (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  year smallint not null check (year between 2020 and 2100),
  counter integer not null default 0 check (counter >= 0),
  primary key (clinic_id, year)
);

comment on table public.appointment_folio_counters is
  'Contador de folios por clínica y año. Solo lo tocan funciones DEFINER (UPSERT atómico).';

-- RLS obligatorio (CLAUDE.md §3). Sin políticas: ningún cliente lo consulta.
alter table public.appointment_folio_counters enable row level security;
alter table public.appointment_folio_counters force row level security;

-- Folio secuencial concurrencia-segura: el UPSERT serializa por fila de
-- contador y garantiza folios únicos sin depender de COUNT(*).
create or replace function public.next_appointment_folio(p_clinic_id uuid, p_year smallint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counter integer;
begin
  insert into public.appointment_folio_counters as c (clinic_id, year, counter)
  values (p_clinic_id, p_year, 1)
  on conflict (clinic_id, year)
  do update set counter = c.counter + 1
  returning counter into v_counter;

  return format('CIT-%s-%s', p_year, lpad(v_counter::text, 6, '0'));
end;
$$;

revoke all on function public.next_appointment_folio(uuid, smallint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Citas
-- ----------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  folio text not null check (folio ~ '^CIT-[0-9]{4}-[0-9]{6}$'),
  pet_id uuid not null references public.pets (id) on delete restrict,
  owner_id uuid not null references public.pet_owners (id) on delete restrict,
  veterinarian_clinic_member_id uuid not null
    references public.clinic_members (id) on delete restrict,
  status public.appointment_status not null default 'requested',
  source public.appointment_source not null default 'staff',
  -- Ventana visible de la cita (timestamptz = UTC; presentación en la zona
  -- de la clínica) y ventana OCUPADA (incluye colchones del servicio).
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  occupies_from timestamptz not null,
  occupies_until timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 1000),
  staff_notes text check (staff_notes is null or char_length(staff_notes) <= 2000),
  emergency boolean not null default false,
  emergency_reason text check (emergency_reason is null or char_length(emergency_reason) <= 500),
  -- Hitos operativos (métricas y trazabilidad).
  checked_in_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancellation_reason text
    check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  no_show_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, folio),
  constraint appointments_ventana_valida check (scheduled_start < scheduled_end),
  constraint appointments_ocupacion_envuelve check (
    occupies_from <= scheduled_start and occupies_until >= scheduled_end
  ),
  constraint appointments_urgencia_con_motivo check (not emergency or emergency_reason is not null),
  constraint appointments_cancelacion_con_motivo check (
    status <> 'cancelled' or (cancelled_at is not null and cancellation_reason is not null)
  ),
  -- ANTI-TRASLAPE: dos citas del mismo profesional no pueden ocupar rangos
  -- que se crucen mientras estén en un estado que ocupa agenda. Estados
  -- terminales y solicitudes sin confirmar no bloquean el calendario.
  constraint appointments_sin_traslape exclude using gist (
    veterinarian_clinic_member_id with =,
    tstzrange(occupies_from, occupies_until, '[)') with &&
  ) where (status in ('pending_confirmation', 'confirmed', 'checked_in', 'in_progress'))
);

comment on table public.appointments is
  'Citas de agenda. Sin borrado físico; anti-traslape por EXCLUDE sobre la ventana ocupada (con colchones).';

create index appointments_clinica_fecha_idx on public.appointments (clinic_id, scheduled_start);
create index appointments_vet_fecha_idx
  on public.appointments (veterinarian_clinic_member_id, scheduled_start);
create index appointments_mascota_idx on public.appointments (pet_id);
create index appointments_propietario_idx on public.appointments (owner_id);
create index appointments_estado_idx on public.appointments (clinic_id, status);

alter table public.appointments enable row level security;
alter table public.appointments force row level security;

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create trigger appointments_enforce_organization
  before insert or update of clinic_id, organization_id on public.appointments
  for each row execute function public.enforce_clinic_organization();

-- Integridad de referencias en la base (además de las validaciones de RPC):
-- el profesional es veterinario activo de la clínica; la mascota tiene
-- relación activa con la clínica; el propietario tiene relación con la mascota.
create or replace function public.enforce_appointment_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clinic_members m
    where m.id = new.veterinarian_clinic_member_id
      and m.clinic_id = new.clinic_id
      and m.role = 'veterinarian'
      and m.status = 'active'
      and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_NO_VETERINARIO: la cita debe asignarse a un veterinario activo de la clínica'
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.clinic_pet_relationships r
    where r.clinic_id = new.clinic_id
      and r.pet_id = new.pet_id
      and r.status = 'active'
      and r.deleted_at is null
  ) then
    raise exception 'MASCOTA_SIN_RELACION: la mascota no tiene relación activa con la clínica'
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.pet_owner_relationships r
    where r.pet_id = new.pet_id
      and r.owner_id = new.owner_id
      and r.status = 'active'
      and r.deleted_at is null
  ) then
    raise exception 'PROPIETARIO_SIN_RELACION: el propietario no tiene relación activa con la mascota'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_appointment_refs() from public, anon, authenticated;

create trigger appointments_enforce_refs
  before insert or update of pet_id, owner_id, veterinarian_clinic_member_id, clinic_id
  on public.appointments
  for each row execute function public.enforce_appointment_refs();

-- ----------------------------------------------------------------------------
-- Máquina de estados: transiciones válidas en un solo lugar (la base).
-- ----------------------------------------------------------------------------
create or replace function public.appointment_transition_allowed(
  p_from public.appointment_status,
  p_to public.appointment_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'requested'            then p_to in ('pending_confirmation', 'confirmed', 'cancelled')
    when 'pending_confirmation' then p_to in ('confirmed', 'cancelled')
    when 'confirmed'            then p_to in ('checked_in', 'cancelled', 'no_show')
    when 'checked_in'           then p_to in ('in_progress', 'cancelled')
    when 'in_progress'          then p_to in ('completed')
    else false -- completed, cancelled y no_show son terminales
  end;
$$;

-- Guardia en la tabla: ni siquiera un UPDATE directo puede saltarse la máquina.
create or replace function public.enforce_appointment_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and not public.appointment_transition_allowed(old.status, new.status) then
    raise exception 'TRANSICION_INVALIDA: % → % no está permitida', old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_appointment_transition() from public, anon, authenticated;

create trigger appointments_enforce_transition
  before update of status on public.appointments
  for each row execute function public.enforce_appointment_transition();

-- ----------------------------------------------------------------------------
-- Historial de estados (append-only), poblado por trigger: no puede omitirse.
-- El motivo viaja en el GUC transaccional app.appointment_reason (lo fijan
-- las RPCs); un cambio directo queda registrado sin motivo.
-- ----------------------------------------------------------------------------
create table public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

comment on table public.appointment_status_history is
  'Historial append-only de estados de cita; lo escribe un trigger, nunca el cliente.';

create index appointment_status_history_cita_idx
  on public.appointment_status_history (appointment_id, created_at);

alter table public.appointment_status_history enable row level security;
alter table public.appointment_status_history force row level security;

create or replace function public.log_appointment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_status_history
      (appointment_id, from_status, to_status, changed_by, reason)
    values (new.id, null, new.status, (select auth.uid()),
            nullif(current_setting('app.appointment_reason', true), ''));
  elsif old.status is distinct from new.status then
    insert into public.appointment_status_history
      (appointment_id, from_status, to_status, changed_by, reason)
    values (new.id, old.status, new.status, (select auth.uid()),
            nullif(current_setting('app.appointment_reason', true), ''));
  end if;
  return new;
end;
$$;

revoke all on function public.log_appointment_status() from public, anon, authenticated;

create trigger appointments_log_status
  after insert or update of status on public.appointments
  for each row execute function public.log_appointment_status();

-- ----------------------------------------------------------------------------
-- Servicios de la cita con SNAPSHOT: si el catálogo cambia de precio o nombre,
-- la cita histórica conserva lo pactado.
-- ----------------------------------------------------------------------------
create table public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  clinic_service_id uuid not null references public.clinic_services (id) on delete restrict,
  service_name text not null,
  category public.service_category not null,
  duration_minutes smallint not null check (duration_minutes between 5 and 480),
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'MXN',
  quantity smallint not null default 1 check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, clinic_service_id)
);

comment on table public.appointment_services is
  'Servicios de la cita con snapshot de nombre, duración y precio al momento de agendar.';

create index appointment_services_cita_idx on public.appointment_services (appointment_id);

alter table public.appointment_services enable row level security;
alter table public.appointment_services force row level security;

create trigger appointment_services_set_updated_at
  before update on public.appointment_services
  for each row execute function public.set_updated_at();
