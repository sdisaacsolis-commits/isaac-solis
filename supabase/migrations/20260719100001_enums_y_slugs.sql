-- ============================================================================
-- Migración 0002 — Enums y utilidades de slugs
-- ============================================================================
-- Decisión (documentada en DATABASE_DESIGN.md §1): los vocabularios cerrados y
-- controlados por versiones de la aplicación se modelan como ENUM de PostgreSQL
-- (tipado fuerte + tipos TS generados). Los catálogos que deben poder crecer
-- sin migración (p. ej. slugs reservados) se modelan como tabla.
-- ============================================================================

create type public.organization_status as enum ('active', 'suspended', 'archived');

create type public.organization_role as enum ('owner', 'admin', 'billing', 'member');

-- Compartido por membresías de organización y de clínica: mismo ciclo de vida.
create type public.membership_status as enum ('invited', 'active', 'suspended', 'removed');

create type public.clinic_status as enum (
  'trial', 'active', 'past_due', 'suspended', 'cancelled', 'archived'
);

create type public.clinic_role as enum (
  'clinic_admin', 'veterinarian', 'receptionist', 'assistant'
);

create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

-- ----------------------------------------------------------------------------
-- Slugs reservados (rutas futuras /clinicas/[slug], /veterinarios/[slug], etc.)
-- Tabla en lugar de constraint: la lista crece sin tocar lógica de validación.
-- ----------------------------------------------------------------------------
create table public.reserved_slugs (
  slug text primary key,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.reserved_slugs enable row level security;
alter table public.reserved_slugs force row level security;

revoke all on table public.reserved_slugs from public, anon, authenticated;
grant select on table public.reserved_slugs to authenticated;

-- Lectura libre para usuarios autenticados (necesaria para validar en UI).
create policy reserved_slugs_select_autenticados
  on public.reserved_slugs for select to authenticated using (true);

insert into public.reserved_slugs (slug, reason) values
  ('admin', 'ruta interna'),
  ('api', 'ruta interna'),
  ('app', 'ruta interna'),
  ('auth', 'ruta interna'),
  ('login', 'ruta interna'),
  ('registro', 'ruta interna'),
  ('clinicas', 'ruta pública futura'),
  ('veterinarios', 'ruta pública futura'),
  ('soporte', 'ruta interna'),
  ('ayuda', 'ruta interna'),
  ('dogtoralia', 'marca'),
  ('www', 'infraestructura');

-- ----------------------------------------------------------------------------
-- Normalización y validación de slug (trigger genérico para tablas con `slug`).
-- SECURITY DEFINER: debe leer reserved_slugs sin depender de los privilegios
-- del actor (la tabla tiene RLS forzado); el dueño (postgres) tiene BYPASSRLS.
-- search_path vacío + referencias calificadas: evita suplantación de objetos.
-- ----------------------------------------------------------------------------
create or replace function public.normalize_slug_and_check_reserved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is null then
    return new;
  end if;

  new.slug := lower(btrim(new.slug));

  if new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(new.slug) < 3
     or char_length(new.slug) > 60 then
    raise exception 'SLUG_INVALIDO: el slug solo puede contener minúsculas, números y guiones simples (3-60 caracteres).'
      using errcode = '23514';
  end if;

  if exists (select 1 from public.reserved_slugs r where r.slug = new.slug) then
    raise exception 'SLUG_RESERVADO: el slug "%" está reservado por la plataforma.', new.slug
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_slug_and_check_reserved() from public, anon, authenticated;
