-- ============================================================================
-- Migración 0016 — Funciones de acceso del dominio de pacientes (Fase 4)
-- ============================================================================
-- Mismas salvaguardas de la Fase 2: SECURITY DEFINER (consultan tablas con RLS
-- forzado y romperían en recursión como INVOKER), STABLE, search_path vacío,
-- sin SQL dinámico, EXECUTE revocado a public/anon. Nunca confían en la
-- clínica enviada por el cliente: derivan las clínicas del ACTOR desde sus
-- membresías activas.
-- ============================================================================

-- ¿La clínica tiene relación ACTIVA con la mascota? (sin evaluar al actor)
create or replace function public.has_active_clinic_pet_relationship(p_clinic_id uuid, p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_pet_relationships r
    where r.clinic_id = p_clinic_id
      and r.pet_id = p_pet_id
      and r.status = 'active'
      and r.deleted_at is null
  );
$$;

-- ¿El propietario tiene relación ACTIVA con la mascota?
create or replace function public.has_active_owner_pet_relationship(p_owner_id uuid, p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pet_owner_relationships r
    where r.owner_id = p_owner_id
      and r.pet_id = p_pet_id
      and r.status = 'active'
      and r.deleted_at is null
  );
$$;

-- ¿Alguna clínica DEL ACTOR (membresía activa) tiene relación activa con la
-- mascota? Incluye a admins de la organización dueña de esa clínica.
create or replace function public.pet_belongs_to_accessible_clinic(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_pet_relationships r
    where r.pet_id = p_pet_id
      and r.status = 'active'
      and r.deleted_at is null
      and (
        exists (
          select 1 from public.clinic_members m
          where m.clinic_id = r.clinic_id
            and m.user_id = (select auth.uid())
            and m.status = 'active'
            and m.deleted_at is null
        )
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = r.organization_id
            and om.user_id = (select auth.uid())
            and om.role in ('owner', 'admin')
            and om.status = 'active'
            and om.deleted_at is null
        )
      )
  );
$$;

-- Lectura de una mascota.
create or replace function public.can_access_pet(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.pet_belongs_to_accessible_clinic(p_pet_id);
$$;

-- Escritura de datos globales de la mascota: personal operativo (clinic_admin,
-- veterinarian, receptionist — asistentes NO) de una clínica relacionada, o
-- admins de su organización. Decisión de matriz documentada en
-- docs/security/roles-and-permissions.md.
create or replace function public.can_manage_pet(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_pet_relationships r
    where r.pet_id = p_pet_id
      and r.status = 'active'
      and r.deleted_at is null
      and (
        exists (
          select 1 from public.clinic_members m
          where m.clinic_id = r.clinic_id
            and m.user_id = (select auth.uid())
            and m.role in ('clinic_admin', 'veterinarian', 'receptionist')
            and m.status = 'active'
            and m.deleted_at is null
        )
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = r.organization_id
            and om.user_id = (select auth.uid())
            and om.role in ('owner', 'admin')
            and om.status = 'active'
            and om.deleted_at is null
        )
      )
  );
$$;

-- Lectura de un propietario: relación activa con una clínica del actor, o
-- vínculo activo con una mascota accesible para el actor.
create or replace function public.can_access_owner(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.owner_clinic_relationships r
      where r.owner_id = p_owner_id
        and r.status = 'active'
        and r.deleted_at is null
        and (
          exists (
            select 1 from public.clinic_members m
            where m.clinic_id = r.clinic_id
              and m.user_id = (select auth.uid())
              and m.status = 'active'
              and m.deleted_at is null
          )
          or exists (
            select 1 from public.organization_members om
            where om.organization_id = r.organization_id
              and om.user_id = (select auth.uid())
              and om.role in ('owner', 'admin')
              and om.status = 'active'
              and om.deleted_at is null
          )
        )
    )
    or exists (
      select 1
      from public.pet_owner_relationships por
      where por.owner_id = p_owner_id
        and por.status = 'active'
        and por.deleted_at is null
        and public.pet_belongs_to_accessible_clinic(por.pet_id)
    );
$$;

-- Escritura sobre un propietario: clinic_admin/recepción de una clínica
-- relacionada, o admins de la organización (los veterinarios solo leen).
create or replace function public.can_manage_owner(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.owner_clinic_relationships r
    where r.owner_id = p_owner_id
      and r.status = 'active'
      and r.deleted_at is null
      and (
        exists (
          select 1 from public.clinic_members m
          where m.clinic_id = r.clinic_id
            and m.user_id = (select auth.uid())
            and m.role in ('clinic_admin', 'receptionist')
            and m.status = 'active'
            and m.deleted_at is null
        )
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = r.organization_id
            and om.user_id = (select auth.uid())
            and om.role in ('owner', 'admin')
            and om.status = 'active'
            and om.deleted_at is null
        )
      )
  );
$$;

-- Personal operativo (no asistentes) de una clínica concreta del actor.
create or replace function public.is_clinic_operational_staff(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.clinic_members m
      where m.clinic_id = p_clinic_id
        and m.user_id = (select auth.uid())
        and m.role in ('clinic_admin', 'veterinarian', 'receptionist')
        and m.status = 'active'
        and m.deleted_at is null
    )
    or public.is_organization_admin(public.organization_of_clinic(p_clinic_id));
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'has_active_clinic_pet_relationship(uuid, uuid)',
    'has_active_owner_pet_relationship(uuid, uuid)',
    'pet_belongs_to_accessible_clinic(uuid)',
    'can_access_pet(uuid)',
    'can_manage_pet(uuid)',
    'can_access_owner(uuid)',
    'can_manage_owner(uuid)',
    'is_clinic_operational_staff(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
