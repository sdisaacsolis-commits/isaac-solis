-- ============================================================================
-- Fase 5 — Catálogo de servicios veterinarios por clínica
-- ============================================================================
-- Cada clínica administra su propio catálogo. El precio se guarda en centavos
-- MXN (enteros; CLAUDE.md §13). Los servicios no se borran físicamente: se
-- desactivan, porque las citas históricas conservan su snapshot.
-- ============================================================================

create table public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  category public.service_category not null,
  description text check (description is null or char_length(description) <= 2000),
  -- Duración efectiva del servicio y colchones operativos (limpieza, notas).
  duration_minutes smallint not null check (duration_minutes between 5 and 480),
  buffer_before_minutes smallint not null default 0 check (buffer_before_minutes between 0 and 120),
  buffer_after_minutes smallint not null default 0 check (buffer_after_minutes between 0 and 120),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency char(3) not null default 'MXN' check (currency = 'MXN'),
  -- true: requiere un veterinario asignado (consulta, cirugía). false: puede
  -- prestarlo otro personal (p. ej. estética) aunque la cita siga anclada a
  -- un miembro de clínica responsable.
  requires_veterinarian boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clinic_services is
  'Catálogo de servicios por clínica. Se desactiva, no se borra: las citas históricas guardan snapshot.';

-- Sin nombres duplicados entre servicios activos de la misma clínica.
create unique index clinic_services_nombre_activo_unico
  on public.clinic_services (clinic_id, lower(btrim(name)))
  where active;

create index clinic_services_clinica_idx on public.clinic_services (clinic_id) where active;
create index clinic_services_categoria_idx on public.clinic_services (clinic_id, category);

alter table public.clinic_services enable row level security;
alter table public.clinic_services force row level security;

create trigger clinic_services_set_updated_at
  before update on public.clinic_services
  for each row execute function public.set_updated_at();

-- La clínica debe pertenecer a la organización declarada (integridad tenant).
create or replace function public.enforce_clinic_organization()
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
    raise exception 'CLINICA_FUERA_DE_ORGANIZACION: la clínica no pertenece a esa organización'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_clinic_organization() from public, anon, authenticated;

create trigger clinic_services_enforce_organization
  before insert or update of clinic_id, organization_id on public.clinic_services
  for each row execute function public.enforce_clinic_organization();

-- ----------------------------------------------------------------------------
-- Veterinarios habilitados por servicio (asignación explícita).
-- ----------------------------------------------------------------------------
create table public.clinic_service_veterinarians (
  id uuid primary key default gen_random_uuid(),
  clinic_service_id uuid not null references public.clinic_services (id) on delete cascade,
  clinic_member_id uuid not null references public.clinic_members (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_service_id, clinic_member_id)
);

comment on table public.clinic_service_veterinarians is
  'Qué veterinarios de la clínica prestan cada servicio del catálogo.';

alter table public.clinic_service_veterinarians enable row level security;
alter table public.clinic_service_veterinarians force row level security;

create trigger clinic_service_veterinarians_set_updated_at
  before update on public.clinic_service_veterinarians
  for each row execute function public.set_updated_at();

-- El miembro asignado debe ser veterinario ACTIVO de la MISMA clínica que el
-- servicio. Integridad en la base, no solo en la app (CLAUDE.md §16).
create or replace function public.enforce_service_veterinarian()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic uuid;
begin
  select s.clinic_id into v_clinic
  from public.clinic_services s where s.id = new.clinic_service_id;

  if not exists (
    select 1 from public.clinic_members m
    where m.id = new.clinic_member_id
      and m.clinic_id = v_clinic
      and m.role = 'veterinarian'
      and m.status = 'active'
      and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_NO_VETERINARIO: solo veterinarios activos de la clínica pueden asignarse'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_service_veterinarian() from public, anon, authenticated;

create trigger clinic_service_veterinarians_enforce_role
  before insert or update on public.clinic_service_veterinarians
  for each row execute function public.enforce_service_veterinarian();
