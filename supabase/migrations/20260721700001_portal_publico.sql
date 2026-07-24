-- ============================================================================
-- Fase 8 — Portal público: perfiles de veterinarios, invitaciones al portal
-- y solicitudes públicas de cita
-- ============================================================================
-- Réplica funcional del marketplace (docs/product/doctoralia-audit.md) con las
-- reglas de siempre: el sitio público NUNCA lee tablas base directamente
-- (solo RPCs SECURITY DEFINER con campos curados), lo público expone SOLO
-- clínicas is_public, y la vinculación propietario↔cuenta es SIEMPRE por
-- verificación explícita de la clínica (regla de Fase 4).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Perfil público del veterinario (a nivel USUARIO: un profesional con varias
-- clínicas, como los perfiles de Doctoralia con varios consultorios).
-- ----------------------------------------------------------------------------
create table public.veterinarian_public_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  headline text check (headline is null or char_length(headline) <= 200),
  bio text check (bio is null or char_length(bio) <= 2000),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.veterinarian_public_profiles is
  'Perfil público OPCIONAL de un veterinario (opt-in con is_public). El sitio público solo lo lee vía RPCs curadas.';

alter table public.veterinarian_public_profiles enable row level security;
alter table public.veterinarian_public_profiles force row level security;

create trigger veterinarian_public_profiles_set_updated_at
  before update on public.veterinarian_public_profiles
  for each row execute function public.set_updated_at();

-- Solo veterinarios ACTIVOS en alguna clínica pueden tener perfil, y el slug
-- no puede ser uno reservado.
create or replace function public.enforce_vet_profile_refs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clinic_members m
    where m.user_id = new.user_id and m.role = 'veterinarian'
      and m.status = 'active' and m.deleted_at is null
  ) then
    raise exception 'MIEMBRO_NO_VETERINARIO: el perfil público es para veterinarios activos'
      using errcode = '23514';
  end if;
  if exists (select 1 from public.reserved_slugs r where r.slug = new.slug) then
    raise exception 'SLUG_RESERVADO: elige otro identificador público' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_vet_profile_refs() from public, anon, authenticated;

create trigger veterinarian_public_profiles_enforce_refs
  before insert or update of user_id, slug on public.veterinarian_public_profiles
  for each row execute function public.enforce_vet_profile_refs();

revoke all on table public.veterinarian_public_profiles from public, anon, authenticated;
grant select on table public.veterinarian_public_profiles to authenticated;
grant insert (user_id, slug, headline, bio, is_public)
  on table public.veterinarian_public_profiles to authenticated;
grant update (slug, headline, bio, is_public, deleted_at)
  on table public.veterinarian_public_profiles to authenticated;
grant all on table public.veterinarian_public_profiles to service_role;

-- Cada quien gestiona SU perfil; los colegas de clínica pueden verlo.
create policy vet_profiles_select_propio_o_colega on public.veterinarian_public_profiles
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.clinic_members mios
      join public.clinic_members suyos on suyos.clinic_id = mios.clinic_id
      where mios.user_id = (select auth.uid())
        and suyos.user_id = veterinarian_public_profiles.user_id
        and mios.status = 'active' and mios.deleted_at is null
        and suyos.status = 'active' and suyos.deleted_at is null
    )
  );
create policy vet_profiles_select_superadmin on public.veterinarian_public_profiles
  for select to authenticated using (public.current_user_is_superadmin());
create policy vet_profiles_insert_propio on public.veterinarian_public_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy vet_profiles_update_propio on public.veterinarian_public_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- Invitación al portal del propietario (tokens hasheados como las
-- invitaciones de personal; la vinculación jamás es automática por correo).
-- ----------------------------------------------------------------------------
create table public.portal_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  owner_id uuid not null references public.pet_owners (id) on delete cascade,
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  token_hash text not null unique check (char_length(token_hash) = 64),
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_invitations_owner_idx on public.portal_invitations (owner_id, status);

alter table public.portal_invitations enable row level security;
alter table public.portal_invitations force row level security;

create trigger portal_invitations_set_updated_at
  before update on public.portal_invitations
  for each row execute function public.set_updated_at();

create trigger portal_invitations_enforce_organization
  before insert or update of clinic_id, organization_id on public.portal_invitations
  for each row execute function public.enforce_clinic_organization();

-- token_hash ilegible para clientes: SELECT solo por columnas explícitas.
revoke all on table public.portal_invitations from public, anon, authenticated;
grant select (id, organization_id, clinic_id, owner_id, email, status, expires_at,
              invited_by, accepted_at, created_at, updated_at)
  on table public.portal_invitations to authenticated;
grant all on table public.portal_invitations to service_role;

create policy portal_invitations_select_operativos on public.portal_invitations
  for select to authenticated using (public.is_clinic_operational_staff(clinic_id));
create policy portal_invitations_select_superadmin on public.portal_invitations
  for select to authenticated using (public.current_user_is_superadmin());

-- ----------------------------------------------------------------------------
-- Solicitud pública de cita (rastro auditable + idempotencia del formulario
-- de invitado; la cita en sí vive en appointments con source owner_portal y
-- estado requested, que NO ocupa agenda hasta que la clínica la confirma).
-- ----------------------------------------------------------------------------
create table public.public_booking_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  owner_id uuid not null references public.pet_owners (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  guest_email text not null
    check (guest_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  request_id uuid,
  created_at timestamptz not null default now()
);

create unique index public_booking_requests_request_unica
  on public.public_booking_requests (clinic_id, request_id)
  where request_id is not null;
create index public_booking_requests_correo_idx
  on public.public_booking_requests (clinic_id, guest_email, created_at);

alter table public.public_booking_requests enable row level security;
alter table public.public_booking_requests force row level security;

revoke all on table public.public_booking_requests from public, anon, authenticated;
grant select on table public.public_booking_requests to authenticated;
grant all on table public.public_booking_requests to service_role;

create policy public_booking_requests_select_operativos on public.public_booking_requests
  for select to authenticated using (public.is_clinic_operational_staff(clinic_id));
create policy public_booking_requests_select_superadmin on public.public_booking_requests
  for select to authenticated using (public.current_user_is_superadmin());
