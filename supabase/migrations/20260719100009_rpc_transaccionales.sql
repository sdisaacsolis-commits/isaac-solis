-- ============================================================================
-- Migración 0010 — Funciones RPC transaccionales
-- ============================================================================
-- Operaciones que crean varios registros relacionados o manejan secretos:
-- se ejecutan como UNA transacción dentro de la función. Solo se implementan
-- las necesarias para esta fase; transferir propiedad, remover miembros y
-- flujos de correo llegan en fases posteriores.
--
-- Todas: SECURITY DEFINER (crean filas que las políticas de INSERT directas
-- no permiten, a propósito), search_path vacío, validación interna de
-- permisos con las funciones auxiliares, y EXECUTE solo para authenticated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Crear organización + su primer owner (el usuario autenticado) atómicamente.
-- ----------------------------------------------------------------------------
create or replace function public.create_organization_with_owner(
  p_name text,
  p_slug text default null,
  p_legal_name text default null,
  p_tax_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_organization_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión para crear una organización.'
      using errcode = '42501';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'NOMBRE_REQUERIDO: el nombre de la organización es obligatorio.'
      using errcode = '23514';
  end if;

  insert into public.organizations (name, legal_name, slug, tax_id, created_by)
  values (
    btrim(p_name),
    nullif(btrim(coalesce(p_legal_name, '')), ''),
    nullif(btrim(coalesce(p_slug, '')), ''),
    nullif(upper(btrim(coalesce(p_tax_id, ''))), ''),
    v_user
  )
  returning id into v_organization_id;

  insert into public.organization_members
    (organization_id, user_id, role, status, joined_at, created_by)
  values (v_organization_id, v_user, 'owner', 'active', now(), v_user);

  return v_organization_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Invitar a una persona a una clínica. Genera el token, guarda SOLO su hash
-- SHA-256 y devuelve el token en claro UNA única vez al invitador autorizado
-- (quien lo entregará por correo en la fase de notificaciones).
-- ----------------------------------------------------------------------------
create or replace function public.invite_clinic_member(
  p_clinic_id uuid,
  p_email text,
  p_role public.clinic_role
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_token text;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión para invitar.'
      using errcode = '42501';
  end if;
  if not (
    public.is_clinic_admin(p_clinic_id)
    or public.is_organization_admin(public.organization_of_clinic(p_clinic_id))
  ) then
    raise exception 'PERMISO_DENEGADO: solo administradores de la clínica o de la organización pueden invitar.'
      using errcode = '42501';
  end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'CORREO_INVALIDO: ingresa un correo electrónico válido.'
      using errcode = '23514';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  begin
    insert into public.clinic_invitations
      (clinic_id, email, role, token_hash, status, expires_at, invited_by)
    values (
      p_clinic_id,
      v_email,
      p_role,
      encode(extensions.digest(v_token, 'sha256'), 'hex'),
      'pending',
      now() + interval '7 days',
      v_user
    );
  exception
    when unique_violation then
      raise exception 'INVITACION_DUPLICADA: ya existe una invitación pendiente para ese correo y rol en esta clínica.'
        using errcode = '23505';
  end;

  return v_token;
end;
$$;

-- ----------------------------------------------------------------------------
-- Aceptar una invitación con el token en claro. Atómico: valida vigencia y
-- correo, crea membresía de organización (member) si no existe, crea la
-- membresía de clínica con el rol invitado y marca la invitación aceptada.
-- Nota: las invitaciones vencidas se rechazan por expires_at; el cambio de
-- status a 'expired' es cosmético y lo hará un job de backend posterior.
-- ----------------------------------------------------------------------------
create or replace function public.accept_clinic_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_invitation public.clinic_invitations%rowtype;
  v_organization_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión para aceptar la invitación.'
      using errcode = '42501';
  end if;
  if p_token is null or btrim(p_token) = '' then
    raise exception 'TOKEN_REQUERIDO: la invitación no es válida.' using errcode = '23514';
  end if;

  select * into v_invitation
  from public.clinic_invitations i
  where i.token_hash = encode(extensions.digest(btrim(p_token), 'sha256'), 'hex')
    and i.status = 'pending'
  for update;

  if not found then
    raise exception 'INVITACION_NO_ENCONTRADA: la invitación no existe o ya fue utilizada.'
      using errcode = 'P0002';
  end if;
  if v_invitation.expires_at <= now() then
    raise exception 'INVITACION_VENCIDA: la invitación expiró; solicita una nueva.'
      using errcode = '23514';
  end if;
  if v_invitation.email <> v_email then
    raise exception 'CORREO_NO_COINCIDE: la invitación fue emitida para otro correo.'
      using errcode = '42501';
  end if;

  v_organization_id := public.organization_of_clinic(v_invitation.clinic_id);

  if exists (
    select 1 from public.organization_members m
    where m.organization_id = v_organization_id
      and m.user_id = v_user
      and m.deleted_at is null
      and m.status in ('invited', 'suspended')
  ) then
    raise exception 'MEMBRESIA_NO_ACTIVA: tu acceso a la organización no está activo; contacta al administrador.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_organization_id
      and m.user_id = v_user
      and m.status = 'active'
      and m.deleted_at is null
  ) then
    insert into public.organization_members
      (organization_id, user_id, role, status, joined_at, created_by)
    values (v_organization_id, v_user, 'member', 'active', now(), v_invitation.invited_by);
  end if;

  begin
    insert into public.clinic_members
      (clinic_id, user_id, role, status, joined_at, created_by)
    values (v_invitation.clinic_id, v_user, v_invitation.role, 'active', now(), v_invitation.invited_by);
  exception
    when unique_violation then
      raise exception 'YA_ES_MIEMBRO: ya tienes una membresía en esta clínica.'
        using errcode = '23505';
  end;

  update public.clinic_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = v_user
  where id = v_invitation.id;

  return v_invitation.clinic_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'create_organization_with_owner(text, text, text, text)',
    'invite_clinic_member(uuid, text, public.clinic_role)',
    'accept_clinic_invitation(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
