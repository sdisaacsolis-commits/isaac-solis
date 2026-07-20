-- ============================================================================
-- Fase 6 — Contenido clínico: nota SOAP, exploración, vitales, diagnósticos,
-- tratamientos, seguimientos, archivos y adendas
-- ============================================================================
-- Guardia central: el contenido clínico SOLO se escribe mientras la consulta
-- está in_progress. Tras finalizar/anular, la base rechaza cualquier cambio
-- aunque la UI falle. Texto plano siempre (sin HTML; la UI renderiza con
-- whitespace-pre-line), lo que elimina scripts/contenido ejecutable.
-- ============================================================================

create or replace function public.enforce_encounter_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encounter uuid := coalesce(new.encounter_id, old.encounter_id);
  v_status public.encounter_status;
begin
  select e.status into v_status from public.clinical_encounters e where e.id = v_encounter;
  if v_status is distinct from 'in_progress' then
    raise exception 'CONSULTA_INMUTABLE: la consulta no está abierta' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_encounter_open() from public, anon, authenticated;

-- Incremento automático de versión (control optimista: el cliente actualiza
-- con WHERE version = esperada; 0 filas afectadas = conflicto).
create or replace function public.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

revoke all on function public.bump_version() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Nota SOAP: UNA nota principal por consulta, versionada. Decisión: una sola
-- nota versionada (vs. múltiples notas) es más segura y simple: la versión
-- final queda congelada por enforce_encounter_open al finalizar.
-- history_summary (antecedentes) vive aquí por privacidad (tabla clínica).
-- ----------------------------------------------------------------------------
create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references public.clinical_encounters (id) on delete cascade,
  history_summary text check (history_summary is null or char_length(history_summary) <= 4000),
  subjective text check (subjective is null or char_length(subjective) <= 8000),
  objective text check (objective is null or char_length(objective) <= 8000),
  assessment text check (assessment is null or char_length(assessment) <= 8000),
  plan text check (plan is null or char_length(plan) <= 8000),
  author_clinic_member_id uuid references public.clinic_members (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinical_notes enable row level security;
alter table public.clinical_notes force row level security;
create trigger clinical_notes_set_updated_at
  before update on public.clinical_notes for each row execute function public.set_updated_at();
create trigger clinical_notes_bump_version
  before update on public.clinical_notes for each row execute function public.bump_version();
create trigger clinical_notes_enforce_open
  before insert or update or delete on public.clinical_notes
  for each row execute function public.enforce_encounter_open();

-- ----------------------------------------------------------------------------
-- Exploración física: campos comunes como columnas + hallazgos adicionales en
-- jsonb (objeto plano validado por CHECK y Zod). Decisión documentada en
-- docs/clinical/domain-model.md: evita un esquema rígido sin perder consulta.
-- ----------------------------------------------------------------------------
create table public.encounter_examinations (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references public.clinical_encounters (id) on delete cascade,
  general_condition text, attitude text, body_condition text, skin_and_coat text,
  eyes text, ears text, oral_cavity text, cardiovascular text, respiratory text,
  digestive text, urinary text, musculoskeletal text, neurological text, lymph_nodes text,
  additional_findings jsonb
    check (additional_findings is null or jsonb_typeof(additional_findings) = 'object'),
  observations text check (observations is null or char_length(observations) <= 4000),
  examined_by uuid references public.clinic_members (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encounter_examinations enable row level security;
alter table public.encounter_examinations force row level security;
create trigger encounter_examinations_set_updated_at
  before update on public.encounter_examinations for each row execute function public.set_updated_at();
create trigger encounter_examinations_bump_version
  before update on public.encounter_examinations for each row execute function public.bump_version();
create trigger encounter_examinations_enforce_open
  before insert or update or delete on public.encounter_examinations
  for each row execute function public.enforce_encounter_open();

-- ----------------------------------------------------------------------------
-- Signos vitales: mediciones append-only (varias por consulta; jamás se
-- sobrescriben). Rangos FÍSICAMENTE posibles, no clínicamente restrictivos.
-- NULL = no medido (distinto de cero); recorded_at lo pone el servidor.
-- ----------------------------------------------------------------------------
create table public.clinical_vitals (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.clinical_encounters (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  recorded_by uuid references public.clinic_members (id) on delete set null,
  weight_kg numeric(6, 3) check (weight_kg is null or (weight_kg > 0 and weight_kg <= 500)),
  temperature_c numeric(4, 1) check (temperature_c is null or temperature_c between 25 and 45),
  heart_rate_bpm smallint check (heart_rate_bpm is null or heart_rate_bpm between 1 and 500),
  respiratory_rate_bpm smallint
    check (respiratory_rate_bpm is null or respiratory_rate_bpm between 1 and 300),
  capillary_refill_seconds numeric(3, 1)
    check (capillary_refill_seconds is null or capillary_refill_seconds between 0 and 30),
  body_condition_score smallint
    check (body_condition_score is null or body_condition_score between 1 and 9),
  pain_score smallint check (pain_score is null or pain_score between 0 and 10),
  hydration_status text check (hydration_status is null or char_length(hydration_status) <= 200),
  mucous_membranes text check (mucous_membranes is null or char_length(mucous_membranes) <= 200),
  blood_pressure_systolic smallint
    check (blood_pressure_systolic is null or blood_pressure_systolic between 20 and 400),
  blood_pressure_diastolic smallint
    check (blood_pressure_diastolic is null or blood_pressure_diastolic between 10 and 300),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinical_vitals_encounter_idx on public.clinical_vitals (encounter_id, recorded_at);
alter table public.clinical_vitals enable row level security;
alter table public.clinical_vitals force row level security;
create trigger clinical_vitals_enforce_open
  before insert or update or delete on public.clinical_vitals
  for each row execute function public.enforce_encounter_open();

-- ----------------------------------------------------------------------------
-- Diagnósticos (sin catálogo externo; code_system preparado para el futuro).
-- ----------------------------------------------------------------------------
create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.clinical_encounters (id) on delete cascade,
  code_system text check (code_system is null or char_length(code_system) <= 50),
  code text check (code is null or char_length(code) <= 50),
  name text not null check (char_length(btrim(name)) between 2 and 300),
  description text check (description is null or char_length(description) <= 2000),
  certainty public.diagnosis_certainty not null default 'presumptive',
  is_primary boolean not null default false,
  diagnosed_by uuid references public.clinic_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Máximo un diagnóstico principal activo por consulta.
create unique index diagnoses_principal_unico
  on public.diagnoses (encounter_id)
  where is_primary and deleted_at is null and certainty <> 'ruled_out';
create index diagnoses_encounter_idx on public.diagnoses (encounter_id);
create index diagnoses_nombre_idx on public.diagnoses (lower(name));
alter table public.diagnoses enable row level security;
alter table public.diagnoses force row level security;
create trigger diagnoses_set_updated_at
  before update on public.diagnoses for each row execute function public.set_updated_at();
create trigger diagnoses_enforce_open
  before insert or update or delete on public.diagnoses
  for each row execute function public.enforce_encounter_open();

-- ----------------------------------------------------------------------------
-- Tratamientos e indicaciones (NO es receta legal ni dispensación).
-- ----------------------------------------------------------------------------
create table public.encounter_treatments (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.clinical_encounters (id) on delete cascade,
  treatment_type public.treatment_type not null default 'other',
  name text not null check (char_length(btrim(name)) between 2 and 300),
  description text check (description is null or char_length(description) <= 2000),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  dosage_text text check (dosage_text is null or char_length(dosage_text) <= 300),
  route_text text check (route_text is null or char_length(route_text) <= 100),
  frequency_text text check (frequency_text is null or char_length(frequency_text) <= 200),
  duration_text text check (duration_text is null or char_length(duration_text) <= 200),
  performed_during_encounter boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index encounter_treatments_encounter_idx on public.encounter_treatments (encounter_id);
alter table public.encounter_treatments enable row level security;
alter table public.encounter_treatments force row level security;
create trigger encounter_treatments_set_updated_at
  before update on public.encounter_treatments for each row execute function public.set_updated_at();
create trigger encounter_treatments_enforce_open
  before insert or update or delete on public.encounter_treatments
  for each row execute function public.enforce_encounter_open();

-- ----------------------------------------------------------------------------
-- Seguimiento recomendado (preparado para vincular una cita futura; la cita
-- NUNCA se crea automáticamente).
-- ----------------------------------------------------------------------------
create table public.encounter_follow_ups (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.clinical_encounters (id) on delete cascade,
  recommended_within_days smallint
    check (recommended_within_days is null or recommended_within_days between 1 and 365),
  reason text not null check (char_length(btrim(reason)) between 2 and 1000),
  service_id uuid references public.clinic_services (id) on delete set null,
  status public.follow_up_status not null default 'pending',
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index encounter_follow_ups_encounter_idx on public.encounter_follow_ups (encounter_id);
alter table public.encounter_follow_ups enable row level security;
alter table public.encounter_follow_ups force row level security;
create trigger encounter_follow_ups_set_updated_at
  before update on public.encounter_follow_ups for each row execute function public.set_updated_at();
create trigger encounter_follow_ups_enforce_open
  before insert or update or delete on public.encounter_follow_ups
  for each row execute function public.enforce_encounter_open();

-- ----------------------------------------------------------------------------
-- Archivos clínicos (metadata; binarios en Storage privado clinical-files).
-- Se permiten adjuntar también tras finalizar (claramente fechados): por eso
-- NO llevan enforce_encounter_open; sí quedan bloqueados si la consulta está
-- anulada (trigger propio) y jamás se editan (sin UPDATE para clientes).
-- ----------------------------------------------------------------------------
create table public.clinical_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete restrict,
  encounter_id uuid not null references public.clinical_encounters (id) on delete restrict,
  storage_path text not null unique check (
    storage_path ~ '^pets/[0-9a-f-]{36}/encounters/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'
  ),
  original_filename text not null check (char_length(original_filename) <= 300),
  mime_type text not null check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes integer not null check (size_bytes > 0),
  kind public.clinical_file_kind not null default 'other',
  description text check (description is null or char_length(description) <= 500),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index clinical_files_encounter_idx on public.clinical_files (encounter_id);
create index clinical_files_pet_idx on public.clinical_files (pet_id);
alter table public.clinical_files enable row level security;
alter table public.clinical_files force row level security;
create trigger clinical_files_set_updated_at
  before update on public.clinical_files for each row execute function public.set_updated_at();

create or replace function public.enforce_encounter_not_voided()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.clinical_encounters e
    where e.id = coalesce(new.encounter_id, old.encounter_id) and e.status = 'voided'
  ) then
    raise exception 'CONSULTA_INMUTABLE: la consulta está anulada' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_encounter_not_voided() from public, anon, authenticated;

create trigger clinical_files_enforce_not_voided
  before insert on public.clinical_files
  for each row execute function public.enforce_encounter_not_voided();

-- ----------------------------------------------------------------------------
-- Adendas: SOLO sobre consultas finalizadas; inmutables (append-only incluso
-- para service_role, como audit_log).
-- ----------------------------------------------------------------------------
create table public.encounter_addenda (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.clinical_encounters (id) on delete restrict,
  content text not null check (char_length(btrim(content)) between 2 and 8000),
  reason text not null check (char_length(btrim(reason)) between 2 and 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index encounter_addenda_encounter_idx on public.encounter_addenda (encounter_id, created_at);
alter table public.encounter_addenda enable row level security;
alter table public.encounter_addenda force row level security;

create or replace function public.enforce_addendum_on_finalized()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clinical_encounters e
    where e.id = new.encounter_id and e.status = 'finalized'
  ) then
    raise exception 'ADENDA_INVALIDA: las adendas solo aplican a consultas finalizadas'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_addendum_on_finalized() from public, anon, authenticated;

create trigger encounter_addenda_enforce_finalized
  before insert on public.encounter_addenda
  for each row execute function public.enforce_addendum_on_finalized();

-- ----------------------------------------------------------------------------
-- Bucket privado de archivos clínicos.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('clinical-files', 'clinical-files', false)
on conflict (id) do nothing;
