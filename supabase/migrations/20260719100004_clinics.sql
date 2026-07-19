-- ============================================================================
-- Migración 0005 — Clínicas y sus miembros
-- ============================================================================
-- Decisión de slug (documentada en DATABASE_DESIGN.md): el slug de clínica es
-- ÚNICO GLOBALMENTE (no solo por organización) porque la ruta pública futura
-- /clinicas/[slug] no incluye a la organización; un slug por-organización
-- obligaría a rutas anidadas o a renombrar clínicas al publicarlas.
-- ============================================================================

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text unique
    check (slug is null or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60)),
  description text check (description is null or char_length(description) <= 2000),
  email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone text check (phone is null or phone ~ '^\+[0-9]{7,15}$'),
  timezone text not null default 'America/Mexico_City',
  currency char(3) not null default 'MXN' check (currency = upper(currency)),
  status public.clinic_status not null default 'trial',
  is_public boolean not null default false,
  accepts_online_booking boolean not null default false,
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

comment on table public.clinics is
  'Clínica o sucursal de una organización. Ciclo de vida en status (PRD §7.3); expedientes nunca se borran en cascada.';
comment on column public.clinics.is_public is
  'Perfil público futuro (/clinicas/[slug]); en MVP siempre false y sin políticas anon.';

create index clinics_organization_idx on public.clinics (organization_id);

alter table public.clinics enable row level security;
alter table public.clinics force row level security;

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

create trigger clinics_slug_normalize
  before insert or update of slug on public.clinics
  for each row execute function public.normalize_slug_and_check_reserved();

-- Ciclo de vida de la clínica: transiciones válidas (PRD §7.3). El trigger
-- aplica a TODOS los roles (incluido service_role): la máquina de estados es
-- una invariante del dominio, no un permiso.
create or replace function public.validate_clinic_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
begin
  v_allowed := case old.status
    when 'trial' then new.status in ('active', 'cancelled')
    when 'active' then new.status in ('past_due', 'suspended', 'cancelled')
    when 'past_due' then new.status in ('active', 'suspended', 'cancelled')
    when 'suspended' then new.status in ('active', 'cancelled')
    when 'cancelled' then new.status in ('active', 'archived')
    when 'archived' then false
  end;
  if not coalesce(v_allowed, false) then
    raise exception 'TRANSICION_INVALIDA: una clínica % no puede pasar a %.', old.status, new.status
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_clinic_status_transition() from public, anon, authenticated;

create trigger clinics_validate_status_transition
  before update of status on public.clinics
  for each row
  when (old.status is distinct from new.status)
  execute function public.validate_clinic_status_transition();

-- Privilegios: INSERT permitido (la política exige admin de la organización);
-- status y organization_id NO son actualizables por clientes (solo backend),
-- y el borrado (lógico) de clínicas también es exclusivo del backend.
revoke all on table public.clinics from public, anon, authenticated;
grant select on table public.clinics to authenticated;
grant insert (organization_id, name, slug, description, email, phone, timezone, currency,
              is_public, accepts_online_booking, address_line_1, address_line_2,
              neighborhood, city, state, postal_code, country_code, created_by)
  on table public.clinics to authenticated;
grant update (name, slug, description, email, phone, timezone, currency, is_public,
              accepts_online_booking, address_line_1, address_line_2, neighborhood,
              city, state, postal_code, country_code)
  on table public.clinics to authenticated;

-- ----------------------------------------------------------------------------
-- Miembros de clínica
-- ----------------------------------------------------------------------------
create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.clinic_role not null,
  status public.membership_status not null default 'active',
  professional_license text
    check (professional_license is null or char_length(professional_license) <= 20),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  joined_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.clinic_members is
  'Membresía y rol operativo de un usuario en una clínica. Requiere membresía activa en la organización dueña.';
comment on column public.clinic_members.professional_license is
  'Cédula profesional. Obligatoria operativamente para veterinarios; se exigirá al activar agenda (Fase 5).';

create unique index clinic_members_una_membresia_viva
  on public.clinic_members (clinic_id, user_id)
  where deleted_at is null and status <> 'removed';

create index clinic_members_user_idx on public.clinic_members (user_id);

alter table public.clinic_members enable row level security;
alter table public.clinic_members force row level security;

create trigger clinic_members_set_updated_at
  before update on public.clinic_members
  for each row execute function public.set_updated_at();

-- Invariante: solo miembros ACTIVOS de la organización dueña pueden tener
-- membresía viva en una clínica. SECURITY DEFINER para evaluar sin el RLS del
-- actor (mismo motivo que ensure_last_owner_remains).
create or replace function public.require_active_org_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if new.status = 'removed' or new.deleted_at is not null then
    return new; -- las membresías cerradas no exigen pertenencia vigente
  end if;

  select c.organization_id into v_organization_id
  from public.clinics c
  where c.id = new.clinic_id;

  if not exists (
    select 1
    from public.organization_members m
    where m.organization_id = v_organization_id
      and m.user_id = new.user_id
      and m.status = 'active'
      and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_SIN_ORGANIZACION: el usuario debe ser miembro activo de la organización dueña de la clínica.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.require_active_org_membership() from public, anon, authenticated;

create trigger clinic_members_require_org_membership
  before insert or update on public.clinic_members
  for each row execute function public.require_active_org_membership();

revoke all on table public.clinic_members from public, anon, authenticated;
grant select on table public.clinic_members to authenticated;
grant insert (clinic_id, user_id, role, status, professional_license, job_title, joined_at, created_by)
  on table public.clinic_members to authenticated;
grant update (role, status, professional_license, job_title, joined_at, deleted_at)
  on table public.clinic_members to authenticated;
