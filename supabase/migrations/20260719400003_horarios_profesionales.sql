-- ============================================================================
-- Fase 5 — Disponibilidad profesional: horarios semanales y excepciones
-- ============================================================================
-- El horario base es semanal (weekday ISO: 1=lunes … 7=domingo) con vigencia
-- opcional. Las horas son HORA LOCAL DE LA CLÍNICA (clinics.timezone, IANA);
-- la conversión a timestamptz ocurre al calcular disponibilidad.
-- ============================================================================

create table public.veterinarian_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  clinic_member_id uuid not null references public.clinic_members (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  effective_from date not null default current_date,
  effective_until date,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint veterinarian_schedules_horas_validas check (start_time < end_time),
  constraint veterinarian_schedules_vigencia_valida
    check (effective_until is null or effective_until >= effective_from),
  -- Anti-traslape en la base: un mismo profesional no puede tener dos ventanas
  -- que se crucen el mismo día de la semana con vigencias que se toquen.
  constraint veterinarian_schedules_sin_traslape exclude using gist (
    clinic_member_id with =,
    weekday with =,
    int4range(
      (extract(hour from start_time) * 60 + extract(minute from start_time))::int,
      (extract(hour from end_time) * 60 + extract(minute from end_time))::int,
      '[)'
    ) with &&,
    daterange(effective_from, effective_until, '[]') with &&
  ) where (active)
);

comment on table public.veterinarian_schedules is
  'Ventanas semanales de atención por profesional (hora local de la clínica; weekday ISO 1-7).';

create index veterinarian_schedules_miembro_idx
  on public.veterinarian_schedules (clinic_member_id, weekday) where active;
create index veterinarian_schedules_clinica_idx
  on public.veterinarian_schedules (clinic_id) where active;

alter table public.veterinarian_schedules enable row level security;
alter table public.veterinarian_schedules force row level security;

create trigger veterinarian_schedules_set_updated_at
  before update on public.veterinarian_schedules
  for each row execute function public.set_updated_at();

create trigger veterinarian_schedules_enforce_organization
  before insert or update of clinic_id, organization_id on public.veterinarian_schedules
  for each row execute function public.enforce_clinic_organization();

-- El horario pertenece a un miembro ACTIVO de la misma clínica con rol que
-- atiende agenda (veterinario). Los demás roles no tienen agenda propia.
create or replace function public.enforce_schedule_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clinic_members m
    where m.id = new.clinic_member_id
      and m.clinic_id = new.clinic_id
      and m.role = 'veterinarian'
      and m.status = 'active'
      and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_NO_VETERINARIO: el horario debe pertenecer a un veterinario activo de la clínica'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_schedule_member() from public, anon, authenticated;

create trigger veterinarian_schedules_enforce_member
  before insert or update on public.veterinarian_schedules
  for each row execute function public.enforce_schedule_member();

-- ----------------------------------------------------------------------------
-- Excepciones: bloquean disponibilidad (vacaciones, cierres…) o la agregan
-- (special_hours). clinic_member_id nulo = aplica a toda la clínica.
-- ----------------------------------------------------------------------------
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  clinic_member_id uuid references public.clinic_members (id) on delete cascade,
  type public.schedule_exception_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_exceptions_rango_valido check (starts_at < ends_at),
  -- Un horario especial agrega disponibilidad de UNA persona concreta.
  constraint schedule_exceptions_special_con_miembro
    check (type <> 'special_hours' or clinic_member_id is not null),
  -- Un cierre de clínica aplica a todos: no admite miembro específico.
  constraint schedule_exceptions_cierre_sin_miembro
    check (type <> 'clinic_closure' or clinic_member_id is null)
);

comment on table public.schedule_exceptions is
  'Excepciones de agenda: bloquean (vacaciones, cierres, festivos…) o agregan (special_hours) disponibilidad.';

create index schedule_exceptions_clinica_idx
  on public.schedule_exceptions (clinic_id, starts_at);
create index schedule_exceptions_miembro_idx
  on public.schedule_exceptions (clinic_member_id, starts_at)
  where clinic_member_id is not null;

alter table public.schedule_exceptions enable row level security;
alter table public.schedule_exceptions force row level security;

create trigger schedule_exceptions_set_updated_at
  before update on public.schedule_exceptions
  for each row execute function public.set_updated_at();

create trigger schedule_exceptions_enforce_organization
  before insert or update of clinic_id, organization_id on public.schedule_exceptions
  for each row execute function public.enforce_clinic_organization();

-- Si la excepción es de una persona, debe ser miembro activo de esa clínica.
create or replace function public.enforce_exception_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.clinic_member_id is not null and not exists (
    select 1 from public.clinic_members m
    where m.id = new.clinic_member_id
      and m.clinic_id = new.clinic_id
      and m.status = 'active'
      and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_FUERA_DE_CLINICA: la excepción debe referir a un miembro activo de la clínica'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_exception_member() from public, anon, authenticated;

create trigger schedule_exceptions_enforce_member
  before insert or update on public.schedule_exceptions
  for each row execute function public.enforce_exception_member();
