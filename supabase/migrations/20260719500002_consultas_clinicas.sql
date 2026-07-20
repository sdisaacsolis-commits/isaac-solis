-- ============================================================================
-- Fase 6 — Consultas clínicas: entidad principal, folio e historial
-- ============================================================================
-- Cita ≠ consulta: la cita es agenda; la consulta es el documento clínico.
-- Una cita origina como máximo UNA consulta no anulada (índice único parcial).
-- Las consultas NUNCA se borran; la anulación (voided) conserva el contenido.
-- ============================================================================

create table public.clinical_folio_counters (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  year smallint not null check (year between 2020 and 2100),
  counter integer not null default 0 check (counter >= 0),
  primary key (clinic_id, year)
);

alter table public.clinical_folio_counters enable row level security;
alter table public.clinical_folio_counters force row level security;

create or replace function public.next_clinical_folio(p_clinic_id uuid, p_year smallint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counter integer;
begin
  insert into public.clinical_folio_counters as c (clinic_id, year, counter)
  values (p_clinic_id, p_year, 1)
  on conflict (clinic_id, year)
  do update set counter = c.counter + 1
  returning counter into v_counter;
  return format('CON-%s-%s', p_year, lpad(v_counter::text, 6, '0'));
end;
$$;

revoke all on function public.next_clinical_folio(uuid, smallint) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Consulta clínica (cabecera ADMINISTRATIVA: el contenido clínico sensible
-- vive en tablas hijas con acceso más restringido; docs/clinical/privacy.md).
-- history_summary/clinical_summary viven en clinical_notes por esa razón.
-- ----------------------------------------------------------------------------
create table public.clinical_encounters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  clinic_pet_relationship_id uuid not null
    references public.clinic_pet_relationships (id) on delete restrict,
  pet_id uuid not null references public.pets (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete restrict,
  responsible_veterinarian_clinic_member_id uuid not null
    references public.clinic_members (id) on delete restrict,
  status public.encounter_status not null default 'in_progress',
  encounter_type public.encounter_type not null default 'scheduled',
  folio text not null check (folio ~ '^CON-[0-9]{4}-[0-9]{6}$'),
  started_at timestamptz not null default now(),
  finalized_at timestamptz,
  finalized_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  chief_complaint text check (chief_complaint is null or char_length(chief_complaint) <= 1000),
  -- Justificaciones operativas para finalizar sin vitales/exploración
  -- (p. ej. paciente agresivo, urgencia, atención administrativa).
  vitals_skipped_reason text
    check (vitals_skipped_reason is null or char_length(vitals_skipped_reason) <= 300),
  examination_skipped_reason text
    check (examination_skipped_reason is null or char_length(examination_skipped_reason) <= 300),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (clinic_id, folio),
  constraint clinical_encounters_finalizada_consistente check (
    status <> 'finalized' or (finalized_at is not null and finalized_by is not null)
  ),
  constraint clinical_encounters_anulada_consistente check (
    status <> 'voided' or (voided_at is not null and void_reason is not null)
  )
);

comment on table public.clinical_encounters is
  'Consulta clínica (cabecera administrativa). Contenido clínico en tablas hijas. Sin borrado físico.';

-- Como máximo UNA consulta no anulada por cita (idempotencia estructural).
create unique index clinical_encounters_una_por_cita
  on public.clinical_encounters (appointment_id)
  where appointment_id is not null and status <> 'voided';

create index clinical_encounters_clinica_idx on public.clinical_encounters (clinic_id, started_at desc);
create index clinical_encounters_mascota_idx on public.clinical_encounters (pet_id, started_at desc);
create index clinical_encounters_vet_idx
  on public.clinical_encounters (responsible_veterinarian_clinic_member_id, started_at desc);
create index clinical_encounters_estado_idx on public.clinical_encounters (clinic_id, status);

alter table public.clinical_encounters enable row level security;
alter table public.clinical_encounters force row level security;

create trigger clinical_encounters_set_updated_at
  before update on public.clinical_encounters
  for each row execute function public.set_updated_at();

create trigger clinical_encounters_enforce_organization
  before insert or update of clinic_id, organization_id on public.clinical_encounters
  for each row execute function public.enforce_clinic_organization();

-- Integridad de referencias: veterinario activo de la clínica, relación
-- clínica–mascota activa y coherente, cita (si existe) de la misma clínica.
create or replace function public.enforce_encounter_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clinic_members m
    where m.id = new.responsible_veterinarian_clinic_member_id
      and m.clinic_id = new.clinic_id and m.role = 'veterinarian'
      and m.status = 'active' and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_NO_VETERINARIO: el responsable debe ser veterinario activo de la clínica'
      using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.clinic_pet_relationships r
    where r.id = new.clinic_pet_relationship_id
      and r.clinic_id = new.clinic_id and r.pet_id = new.pet_id
      and r.status = 'active' and r.deleted_at is null
  ) then
    raise exception 'MASCOTA_SIN_RELACION: la mascota no tiene relación activa con la clínica'
      using errcode = '23514';
  end if;
  if new.appointment_id is not null and not exists (
    select 1 from public.appointments a
    where a.id = new.appointment_id and a.clinic_id = new.clinic_id
      and a.pet_id = new.pet_id
  ) then
    raise exception 'CITA_INCONSISTENTE: la cita no corresponde a la clínica y mascota'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_encounter_refs() from public, anon, authenticated;

create trigger clinical_encounters_enforce_refs
  before insert or update of clinic_id, pet_id, appointment_id,
    responsible_veterinarian_clinic_member_id, clinic_pet_relationship_id
  on public.clinical_encounters
  for each row execute function public.enforce_encounter_refs();

-- Máquina de estados (autoridad en la base; espejo TS en @dogtoralia/types).
create or replace function public.encounter_transition_allowed(
  p_from public.encounter_status, p_to public.encounter_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'in_progress' then p_to in ('finalized', 'voided')
    when 'finalized'   then p_to = 'voided' -- anulación administrativa; jamás "desfinalizar"
    else false
  end;
$$;

create or replace function public.enforce_encounter_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     and not public.encounter_transition_allowed(old.status, new.status) then
    raise exception 'TRANSICION_INVALIDA: % → % no está permitida', old.status, new.status
      using errcode = '23514';
  end if;
  -- Una consulta que dejó de estar abierta solo cambia por las RPCs internas
  -- (finalize/void), que fijan el GUC app.encounter_admin_op.
  if old.status <> 'in_progress'
     and coalesce(current_setting('app.encounter_admin_op', true), '') = '' then
    raise exception 'CONSULTA_INMUTABLE: una consulta finalizada o anulada no se modifica'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_encounter_transition() from public, anon, authenticated;

create trigger clinical_encounters_enforce_transition
  before update on public.clinical_encounters
  for each row execute function public.enforce_encounter_transition();

-- ----------------------------------------------------------------------------
-- Historial de estados (append-only, por trigger).
-- ----------------------------------------------------------------------------
create table public.encounter_status_history (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.clinical_encounters (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  from_status public.encounter_status,
  to_status public.encounter_status not null,
  reason text check (reason is null or char_length(reason) <= 500),
  metadata jsonb,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index encounter_status_history_idx
  on public.encounter_status_history (encounter_id, created_at);

alter table public.encounter_status_history enable row level security;
alter table public.encounter_status_history force row level security;

create or replace function public.log_encounter_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.encounter_status_history
      (encounter_id, organization_id, clinic_id, from_status, to_status, changed_by)
    values (new.id, new.organization_id, new.clinic_id, null, new.status, (select auth.uid()));
  elsif old.status is distinct from new.status then
    insert into public.encounter_status_history
      (encounter_id, organization_id, clinic_id, from_status, to_status, reason, changed_by)
    values (new.id, new.organization_id, new.clinic_id, old.status, new.status,
            nullif(current_setting('app.encounter_reason', true), ''), (select auth.uid()));
  end if;
  return new;
end;
$$;

revoke all on function public.log_encounter_status() from public, anon, authenticated;

create trigger clinical_encounters_log_status
  after insert or update of status on public.clinical_encounters
  for each row execute function public.log_encounter_status();
