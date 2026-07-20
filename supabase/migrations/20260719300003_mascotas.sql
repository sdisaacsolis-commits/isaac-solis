-- ============================================================================
-- Migración 0015 — Mascotas y sus relaciones (Fase 4)
-- ============================================================================
-- La mascota es una IDENTIDAD GLOBAL: no lleva clinic_id. Puede tener varios
-- propietarios (pet_owner_relationships) y ser atendida por varias clínicas
-- (clinic_pet_relationships). Los datos por-clínica viven en la relación.
-- ============================================================================

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  species public.pet_species not null,
  breed text check (breed is null or char_length(breed) <= 100),
  sex public.pet_sex not null default 'unknown',
  -- La edad NUNCA se almacena: se calcula desde birth_date en presentación.
  birth_date date check (birth_date is null or birth_date <= now()::date),
  approximate_birth_date boolean not null default false,
  color text check (color is null or char_length(color) <= 100),
  identifying_marks text check (identifying_marks is null or char_length(identifying_marks) <= 500),
  microchip_number text
    check (microchip_number is null or microchip_number ~ '^[A-Z0-9]{5,25}$'),
  sterilized boolean,
  deceased_at date,
  -- Ruta INTERNA en el bucket privado pet-photos; jamás URLs firmadas.
  photo_path text check (photo_path is null or photo_path ~ '^pets/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.pets is
  'Identidad global de la mascota: estable aunque cambie de clínica. El acceso lo dan las relaciones activas.';

-- Microchip único entre registros activos (los históricos/borrados no chocan).
create unique index pets_microchip_unico
  on public.pets (microchip_number)
  where microchip_number is not null and deleted_at is null;

create index pets_nombre_idx on public.pets (lower(name));
create index pets_especie_idx on public.pets (species);

alter table public.pets enable row level security;
alter table public.pets force row level security;

create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- Normalización de microchip: mayúsculas, sin espacios ni guiones.
create or replace function public.normalize_pet_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.microchip_number :=
    nullif(upper(regexp_replace(coalesce(new.microchip_number, ''), '[\s\-]', '', 'g')), '');
  return new;
end;
$$;

revoke all on function public.normalize_pet_fields() from public, anon, authenticated;

create trigger pets_normalize_fields
  before insert or update on public.pets
  for each row execute function public.normalize_pet_fields();

-- ----------------------------------------------------------------------------
-- Relación propietario–mascota (varios propietarios por mascota).
-- ----------------------------------------------------------------------------
create table public.pet_owner_relationships (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  owner_id uuid not null references public.pet_owners (id) on delete cascade,
  relationship_type public.owner_pet_relationship_type not null default 'owner',
  is_primary boolean not null default false,
  can_make_medical_decisions boolean not null default true,
  can_receive_notifications boolean not null default true,
  -- El acceso al portal futuro dependerá de ESTA relación, no del correo.
  can_access_portal boolean not null default false,
  status public.owner_pet_relationship_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.pet_owner_relationships is
  'Vínculo propietario↔mascota. Histórico: nunca se borra físicamente; se marca inactive/revoked.';

-- Una sola relación viva por (mascota, propietario).
create unique index pet_owner_relationships_una_activa
  on public.pet_owner_relationships (pet_id, owner_id)
  where status = 'active' and deleted_at is null;

-- Exactamente un contacto principal ACTIVO por mascota (decisión de dominio).
create unique index pet_owner_relationships_un_principal
  on public.pet_owner_relationships (pet_id)
  where is_primary and status = 'active' and deleted_at is null;

create index pet_owner_relationships_owner_idx
  on public.pet_owner_relationships (owner_id, status);
create index pet_owner_relationships_pet_idx
  on public.pet_owner_relationships (pet_id, status);

alter table public.pet_owner_relationships enable row level security;
alter table public.pet_owner_relationships force row level security;

create trigger pet_owner_relationships_set_updated_at
  before update on public.pet_owner_relationships
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Relación clínica–mascota: la ÚNICA fuente de acceso operativo de una clínica
-- a una mascota. Los datos internos de la clínica viven aquí.
-- ----------------------------------------------------------------------------
create table public.clinic_pet_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  internal_patient_number text
    check (internal_patient_number is null or char_length(internal_patient_number) <= 30),
  status public.clinic_pet_status not null default 'active',
  source public.clinic_pet_source not null default 'manual',
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  referred_by_clinic_id uuid references public.clinics (id) on delete set null,
  administrative_notes text
    check (administrative_notes is null or char_length(administrative_notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.clinic_pet_relationships is
  'Vínculo clínica↔mascota. Solo status=active otorga acceso. Notas y número interno EXCLUSIVOS de la clínica.';

create unique index clinic_pet_relationships_una_activa
  on public.clinic_pet_relationships (clinic_id, pet_id)
  where status = 'active' and deleted_at is null;

create unique index clinic_pet_relationships_numero_paciente
  on public.clinic_pet_relationships (clinic_id, internal_patient_number)
  where internal_patient_number is not null and deleted_at is null;

create index clinic_pet_relationships_pet_idx on public.clinic_pet_relationships (pet_id, status);
create index clinic_pet_relationships_clinic_idx
  on public.clinic_pet_relationships (clinic_id, status, created_at desc);

alter table public.clinic_pet_relationships enable row level security;
alter table public.clinic_pet_relationships force row level security;

create trigger clinic_pet_relationships_set_updated_at
  before update on public.clinic_pet_relationships
  for each row execute function public.set_updated_at();

create trigger clinic_pet_relationships_clinica_en_org
  before insert or update on public.clinic_pet_relationships
  for each row execute function public.require_clinic_in_organization();

-- ----------------------------------------------------------------------------
-- Alertas ADMINISTRATIVAS por clínica (no clínicas: sin diagnósticos/alergias,
-- eso pertenece al expediente de la Fase 6).
-- ----------------------------------------------------------------------------
create table public.pet_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  type public.pet_alert_type not null,
  severity public.pet_alert_severity not null default 'caution',
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

comment on table public.pet_alerts is
  'Alertas administrativas (manejo, cobranza, comunicación) EXCLUSIVAS de la clínica que las creó.';

create index pet_alerts_clinic_pet_idx on public.pet_alerts (clinic_id, pet_id, active);

alter table public.pet_alerts enable row level security;
alter table public.pet_alerts force row level security;

create trigger pet_alerts_set_updated_at
  before update on public.pet_alerts
  for each row execute function public.set_updated_at();

create trigger pet_alerts_clinica_en_org
  before insert or update on public.pet_alerts
  for each row execute function public.require_clinic_in_organization();
