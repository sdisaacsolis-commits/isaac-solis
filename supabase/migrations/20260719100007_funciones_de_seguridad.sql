-- ============================================================================
-- Migración 0008 — Funciones auxiliares de seguridad (usadas por políticas RLS)
-- ============================================================================
-- TODAS son SECURITY DEFINER y por qué: consultan tablas con RLS FORZADO
-- (profiles, organization_members, clinic_members, clinics). Si fueran
-- SECURITY INVOKER, la política de la tabla A llamaría a una función que lee
-- la tabla B bajo las políticas del actor, que a su vez llaman funciones que
-- leen B... (recursión y resultados incorrectos). Con DEFINER se ejecutan como
-- el dueño (postgres, con BYPASSRLS en Supabase), rompen el ciclo y evalúan
-- la membresía REAL, no la visible para el actor.
--
-- Salvaguardas comunes:
--   * `set search_path = ''` + referencias totalmente calificadas (sin
--     suplantación de objetos ni inyección vía search_path).
--   * STABLE: solo lectura, cacheables dentro de la sentencia.
--   * Sin SQL dinámico (sin riesgo de inyección).
--   * EXECUTE revocado a public/anon; concedido solo a authenticated y
--     service_role.
--   * Devuelven boolean/uuid, nunca filas de datos.
-- ============================================================================

-- ¿El usuario de la sesión es superadministrador de la plataforma?
create or replace function public.current_user_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.is_superadmin
      from public.profiles p
      where p.id = (select auth.uid())
        and p.deleted_at is null
    ),
    false
  );
$$;

-- ¿El usuario tiene membresía ACTIVA en la organización?
create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

-- ¿El usuario es owner o admin ACTIVO de la organización?
create or replace function public.is_organization_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

-- ¿El usuario es owner ACTIVO de la organización?
create or replace function public.is_organization_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

-- ¿El usuario tiene membresía ACTIVA en la clínica?
create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_members m
    where m.clinic_id = p_clinic_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

-- ¿El usuario es administrador ACTIVO de la clínica?
create or replace function public.is_clinic_admin(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_members m
    where m.clinic_id = p_clinic_id
      and m.user_id = (select auth.uid())
      and m.role = 'clinic_admin'
      and m.status = 'active'
      and m.deleted_at is null
  );
$$;

-- ¿La clínica pertenece a la organización?
create or replace function public.clinic_belongs_to_organization(p_clinic_id uuid, p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinics c
    where c.id = p_clinic_id
      and c.organization_id = p_organization_id
  );
$$;

-- Organización dueña de una clínica (null si no existe).
create or replace function public.organization_of_clinic(p_clinic_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.organization_id
  from public.clinics c
  where c.id = p_clinic_id;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'current_user_is_superadmin()',
    'is_organization_member(uuid)',
    'is_organization_admin(uuid)',
    'is_organization_owner(uuid)',
    'is_clinic_member(uuid)',
    'is_clinic_admin(uuid)',
    'clinic_belongs_to_organization(uuid, uuid)',
    'organization_of_clinic(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
