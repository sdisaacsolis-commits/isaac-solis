-- ============================================================================
-- Migración 0014 — Propietarios de mascotas (Fase 4)
-- ============================================================================
-- pet_owners es una identidad GLOBAL (sin clinic_id): una clínica solo la ve a
-- través de owner_clinic_relationships o de una mascota accesible.
-- Decisión: las notas administrativas NO viven en pet_owners sino en la
-- relación propietario–clínica, para que jamás se filtren entre clínicas.
-- ============================================================================

create table public.pet_owners (
  id uuid primary key default gen_random_uuid(),
  -- Enlace futuro a una cuenta (portal): SIEMPRE mediante verificación
  -- explícita, nunca automática por coincidencia de correo.
  user_id uuid references public.profiles (id) on delete set null,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 100),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 100),
  display_name text check (display_name is null or char_length(display_name) <= 150),
  email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone text check (phone is null or phone ~ '^\+[0-9]{7,15}$'),
  secondary_phone text check (secondary_phone is null or secondary_phone ~ '^\+[0-9]{7,15}$'),
  preferred_contact_method public.contact_method not null default 'phone',
  address_line_1 text check (address_line_1 is null or char_length(address_line_1) <= 200),
  address_line_2 text check (address_line_2 is null or char_length(address_line_2) <= 200),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 120),
  city text check (city is null or char_length(city) <= 120),
  state text check (state is null or char_length(state) <= 120),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  country_code char(2) not null default 'MX' check (country_code = upper(country_code)),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.pet_owners is
  'Propietario/tutor de mascotas. Identidad global; el acceso lo dan las relaciones. Sin unicidad global de correo/teléfono (familias comparten contacto): los duplicados se DETECTAN, no se bloquean.';

-- Búsqueda dentro del alcance autorizado (los predicados RLS filtran filas).
create index pet_owners_email_idx on public.pet_owners (email) where email is not null;
create index pet_owners_phone_idx on public.pet_owners (phone) where phone is not null;
create index pet_owners_nombre_idx
  on public.pet_owners (lower(first_name), lower(last_name));

alter table public.pet_owners enable row level security;
alter table public.pet_owners force row level security;

create trigger pet_owners_set_updated_at
  before update on public.pet_owners
  for each row execute function public.set_updated_at();

-- Normalización de contacto (correo minúsculas, teléfonos sin separadores).
create or replace function public.normalize_pet_owner_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '[\s\-().]', '', 'g'), '');
  new.secondary_phone :=
    nullif(regexp_replace(coalesce(new.secondary_phone, ''), '[\s\-().]', '', 'g'), '');
  new.first_name := btrim(new.first_name);
  new.last_name := btrim(new.last_name);
  new.display_name := nullif(btrim(coalesce(new.display_name, '')), '');
  return new;
end;
$$;

revoke all on function public.normalize_pet_owner_contact() from public, anon, authenticated;

create trigger pet_owners_normalize_contact
  before insert or update on public.pet_owners
  for each row execute function public.normalize_pet_owner_contact();

-- ----------------------------------------------------------------------------
-- Relación propietario–clínica: cartera de clientes de la clínica. NO otorga
-- acceso a todas las mascotas del propietario (cada mascota exige su propia
-- relación clínica–mascota).
-- ----------------------------------------------------------------------------
create table public.owner_clinic_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  owner_id uuid not null references public.pet_owners (id) on delete cascade,
  status public.clinic_pet_status not null default 'active',
  internal_customer_number text
    check (internal_customer_number is null or char_length(internal_customer_number) <= 30),
  administrative_notes text
    check (administrative_notes is null or char_length(administrative_notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.owner_clinic_relationships is
  'Relación comercial clínica↔propietario. Las notas administrativas son EXCLUSIVAS de la clínica.';

create unique index owner_clinic_relationships_una_activa
  on public.owner_clinic_relationships (clinic_id, owner_id)
  where status = 'active' and deleted_at is null;

create unique index owner_clinic_relationships_numero_cliente
  on public.owner_clinic_relationships (clinic_id, internal_customer_number)
  where internal_customer_number is not null and deleted_at is null;

create index owner_clinic_relationships_owner_idx on public.owner_clinic_relationships (owner_id);
create index owner_clinic_relationships_clinic_idx
  on public.owner_clinic_relationships (clinic_id, status);

alter table public.owner_clinic_relationships enable row level security;
alter table public.owner_clinic_relationships force row level security;

create trigger owner_clinic_relationships_set_updated_at
  before update on public.owner_clinic_relationships
  for each row execute function public.set_updated_at();

-- La clínica debe pertenecer a la organización indicada.
create or replace function public.require_clinic_in_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clinics c
    where c.id = new.clinic_id and c.organization_id = new.organization_id
  ) then
    raise exception 'CLINICA_FUERA_DE_ORGANIZACION: la clínica no pertenece a la organización indicada.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.require_clinic_in_organization() from public, anon, authenticated;

create trigger owner_clinic_relationships_clinica_en_org
  before insert or update on public.owner_clinic_relationships
  for each row execute function public.require_clinic_in_organization();

-- ----------------------------------------------------------------------------
-- Consentimientos del propietario: versionados, con fecha, medio y actor.
-- Nunca un booleano suelto. Append + revocación (sin borrado).
-- ----------------------------------------------------------------------------
create table public.owner_consents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.pet_owners (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  clinic_id uuid references public.clinics (id) on delete set null,
  type public.consent_type not null,
  document_version text not null check (char_length(document_version) between 1 and 40),
  granted_at timestamptz not null default now(),
  medium public.consent_medium not null default 'in_person',
  recorded_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.owner_consents is
  'Consentimientos versionados (LFPDPPP). metadata jamás contiene datos sensibles.';

create index owner_consents_owner_idx on public.owner_consents (owner_id, type);

alter table public.owner_consents enable row level security;
alter table public.owner_consents force row level security;

create trigger owner_consents_set_updated_at
  before update on public.owner_consents
  for each row execute function public.set_updated_at();
