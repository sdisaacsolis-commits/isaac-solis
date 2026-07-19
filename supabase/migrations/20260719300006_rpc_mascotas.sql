-- ============================================================================
-- Migración 0018 — RPCs transaccionales del dominio de pacientes (Fase 4)
-- ============================================================================
-- El alta multi-fila JAMÁS se hace con inserts sueltos desde el navegador:
-- estas funciones validan permisos con las funciones de acceso, ejecutan todo
-- en una transacción (rollback automático ante cualquier fallo) y dejan la
-- auditoría vía triggers. SECURITY DEFINER, search_path vacío, EXECUTE solo
-- para authenticated/service_role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Registrar propietario + su relación con la clínica del actor.
-- ----------------------------------------------------------------------------
create or replace function public.register_owner_with_clinic(
  p_clinic_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text default null,
  p_phone text default null,
  p_secondary_phone text default null,
  p_preferred_contact_method public.contact_method default 'phone',
  p_address_line_1 text default null,
  p_address_line_2 text default null,
  p_neighborhood text default null,
  p_city text default null,
  p_state text default null,
  p_postal_code text default null,
  p_administrative_notes text default null,
  p_internal_customer_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_owner_id uuid;
  v_organization_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  -- Recepción y administradores registran propietarios; veterinarios no.
  if not (
    public.is_clinic_admin(p_clinic_id)
    or public.is_organization_admin(public.organization_of_clinic(p_clinic_id))
    or exists (
      select 1 from public.clinic_members m
      where m.clinic_id = p_clinic_id
        and m.user_id = v_user
        and m.role = 'receptionist'
        and m.status = 'active'
        and m.deleted_at is null
    )
  ) then
    raise exception 'PERMISO_DENEGADO: tu rol no puede registrar propietarios en esta clínica.'
      using errcode = '42501';
  end if;

  v_organization_id := public.organization_of_clinic(p_clinic_id);

  insert into public.pet_owners
    (first_name, last_name, email, phone, secondary_phone, preferred_contact_method,
     address_line_1, address_line_2, neighborhood, city, state, postal_code, created_by)
  values
    (p_first_name, p_last_name, p_email, p_phone, p_secondary_phone,
     coalesce(p_preferred_contact_method, 'phone'),
     p_address_line_1, p_address_line_2, p_neighborhood, p_city, p_state, p_postal_code, v_user)
  returning id into v_owner_id;

  insert into public.owner_clinic_relationships
    (organization_id, clinic_id, owner_id, status, internal_customer_number,
     administrative_notes, created_by)
  values
    (v_organization_id, p_clinic_id, v_owner_id, 'active', p_internal_customer_number,
     nullif(btrim(coalesce(p_administrative_notes, '')), ''), v_user);

  return v_owner_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Registrar mascota + relación con propietario principal + relación con la
-- clínica, atómico. El propietario debe ser accesible para el actor.
-- ----------------------------------------------------------------------------
create or replace function public.register_pet_with_relationships(
  p_clinic_id uuid,
  p_owner_id uuid,
  p_name text,
  p_species public.pet_species,
  p_breed text default null,
  p_sex public.pet_sex default 'unknown',
  p_birth_date date default null,
  p_approximate_birth_date boolean default false,
  p_color text default null,
  p_identifying_marks text default null,
  p_microchip_number text default null,
  p_sterilized boolean default null,
  p_relationship_type public.owner_pet_relationship_type default 'owner',
  p_internal_patient_number text default null,
  p_source public.clinic_pet_source default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_pet_id uuid;
  v_organization_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if not public.is_clinic_operational_staff(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no puede registrar mascotas en esta clínica.'
      using errcode = '42501';
  end if;
  if not public.can_access_owner(p_owner_id) then
    raise exception 'PROPIETARIO_NO_ACCESIBLE: el propietario no existe o no pertenece a tu alcance.'
      using errcode = '42501';
  end if;

  v_organization_id := public.organization_of_clinic(p_clinic_id);

  begin
    insert into public.pets
      (name, species, breed, sex, birth_date, approximate_birth_date, color,
       identifying_marks, microchip_number, sterilized, created_by)
    values
      (p_name, p_species, p_breed, coalesce(p_sex, 'unknown'), p_birth_date,
       coalesce(p_approximate_birth_date, false), p_color, p_identifying_marks,
       p_microchip_number, p_sterilized, v_user)
    returning id into v_pet_id;
  exception
    when unique_violation then
      raise exception 'MICROCHIP_DUPLICADO: ya existe una mascota activa con ese microchip.'
        using errcode = '23505';
  end;

  insert into public.pet_owner_relationships
    (pet_id, owner_id, relationship_type, is_primary, status, created_by)
  values (v_pet_id, p_owner_id, coalesce(p_relationship_type, 'owner'), true, 'active', v_user);

  insert into public.clinic_pet_relationships
    (organization_id, clinic_id, pet_id, internal_patient_number, status, source,
     first_visit_at, created_by)
  values (v_organization_id, p_clinic_id, v_pet_id, p_internal_patient_number, 'active',
          coalesce(p_source, 'manual'), now(), v_user);

  return v_pet_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Añadir un propietario adicional a una mascota (no toca al principal).
-- ----------------------------------------------------------------------------
create or replace function public.add_pet_owner(
  p_pet_id uuid,
  p_owner_id uuid,
  p_relationship_type public.owner_pet_relationship_type default 'family_member'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_relationship_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if not public.can_manage_pet(p_pet_id) then
    raise exception 'PERMISO_DENEGADO: no puedes administrar esta mascota.'
      using errcode = '42501';
  end if;
  if not public.can_access_owner(p_owner_id) then
    raise exception 'PROPIETARIO_NO_ACCESIBLE: el propietario no existe o no pertenece a tu alcance.'
      using errcode = '42501';
  end if;

  begin
    insert into public.pet_owner_relationships
      (pet_id, owner_id, relationship_type, is_primary, status, created_by)
    values (p_pet_id, p_owner_id, coalesce(p_relationship_type, 'family_member'),
            false, 'active', v_user)
    returning id into v_relationship_id;
  exception
    when unique_violation then
      raise exception 'RELACION_DUPLICADA: esa persona ya tiene una relación activa con la mascota.'
        using errcode = '23505';
  end;

  return v_relationship_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Transferir el contacto principal: mantiene EXACTAMENTE un principal activo.
-- ----------------------------------------------------------------------------
create or replace function public.set_primary_pet_owner(p_pet_id uuid, p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if not public.can_manage_pet(p_pet_id) then
    raise exception 'PERMISO_DENEGADO: no puedes administrar esta mascota.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.pet_owner_relationships r
    where r.pet_id = p_pet_id and r.owner_id = p_owner_id
      and r.status = 'active' and r.deleted_at is null
  ) then
    raise exception 'RELACION_NO_ACTIVA: esa persona no tiene una relación activa con la mascota.'
      using errcode = '23514';
  end if;

  update public.pet_owner_relationships
  set is_primary = false
  where pet_id = p_pet_id and is_primary and status = 'active' and deleted_at is null;

  update public.pet_owner_relationships
  set is_primary = true
  where pet_id = p_pet_id and owner_id = p_owner_id
    and status = 'active' and deleted_at is null;
end;
$$;

-- ----------------------------------------------------------------------------
-- Vincular una mascota EXISTENTE a otra clínica del alcance del actor.
-- Proceso explícito: el actor debe (a) poder acceder a la mascota por alguna
-- de sus clínicas y (b) ser personal operativo de la clínica destino. El
-- intercambio entre organizaciones ajenas llegará con el consentimiento del
-- propietario (portal, fase futura).
-- ----------------------------------------------------------------------------
create or replace function public.link_pet_to_clinic(
  p_pet_id uuid,
  p_clinic_id uuid,
  p_source public.clinic_pet_source default 'manual',
  p_internal_patient_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_relationship_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if not public.is_clinic_operational_staff(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no puede vincular mascotas en la clínica destino.'
      using errcode = '42501';
  end if;
  if not public.can_access_pet(p_pet_id) then
    raise exception 'MASCOTA_NO_ACCESIBLE: la mascota no existe o no pertenece a tu alcance.'
      using errcode = '42501';
  end if;

  begin
    insert into public.clinic_pet_relationships
      (organization_id, clinic_id, pet_id, internal_patient_number, status, source, created_by)
    values (public.organization_of_clinic(p_clinic_id), p_clinic_id, p_pet_id,
            p_internal_patient_number, 'active', coalesce(p_source, 'manual'), v_user)
    returning id into v_relationship_id;
  exception
    when unique_violation then
      raise exception 'RELACION_DUPLICADA: la clínica ya tiene una relación activa con esta mascota.'
        using errcode = '23505';
  end;

  return v_relationship_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'register_owner_with_clinic(uuid, text, text, text, text, text, public.contact_method, text, text, text, text, text, text, text, text)',
    'register_pet_with_relationships(uuid, uuid, text, public.pet_species, text, public.pet_sex, date, boolean, text, text, text, boolean, public.owner_pet_relationship_type, text, public.clinic_pet_source)',
    'add_pet_owner(uuid, uuid, public.owner_pet_relationship_type)',
    'set_primary_pet_owner(uuid, uuid)',
    'link_pet_to_clinic(uuid, uuid, public.clinic_pet_source, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
