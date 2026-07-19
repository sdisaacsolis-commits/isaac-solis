-- ============================================================================
-- Migración 0011 — Visibilidad mínima de perfiles entre colegas (Fase 3)
-- ============================================================================
-- La Fase 2 dejó los perfiles visibles solo para su dueño y el superadmin.
-- Para mostrar al personal en la UI se expone una VISTA segura con únicamente
-- columnas básicas (sin teléfono, sin is_superadmin, sin locale), filtrada a
-- personas que comparten una organización ACTIVA con el actor.
--
-- Por qué vista y no política sobre profiles: una política abriría TODAS las
-- columnas concedidas de la tabla; la vista restringe columnas y filtro en un
-- solo objeto auditable. La vista es SECURITY DEFINER (dueño postgres, con
-- BYPASSRLS) y su cláusula WHERE es la barrera; security_barrier evita que
-- funciones maliciosas se evalúen antes del filtro.
-- ============================================================================

create or replace function public.shares_active_organization_with(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b
      on b.organization_id = a.organization_id
    where a.user_id = (select auth.uid())
      and a.status = 'active'
      and a.deleted_at is null
      and b.user_id = p_profile_id
      and b.status = 'active'
      and b.deleted_at is null
  );
$$;

revoke all on function public.shares_active_organization_with(uuid) from public, anon;
grant execute on function public.shares_active_organization_with(uuid)
  to authenticated, service_role;

create view public.colleague_profiles
with (security_barrier = true) as
select
  p.id,
  p.display_name,
  p.first_name,
  p.last_name,
  p.avatar_url
from public.profiles p
where p.deleted_at is null
  and (
    p.id = (select auth.uid())
    or public.shares_active_organization_with(p.id)
  );

comment on view public.colleague_profiles is
  'Datos básicos de perfiles de personas que comparten una organización activa con el actor. Sin datos sensibles.';

revoke all on public.colleague_profiles from public, anon;
grant select on public.colleague_profiles to authenticated, service_role;
