-- ============================================================================
-- Migración 0012 — RPCs de Fase 3: crear clínica con admin y reenviar invitación
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Crear una clínica y dejar a su creador como clinic_admin, atómicamente.
-- Usada por el onboarding (primera clínica) y por "nueva clínica".
-- SECURITY DEFINER: crea dos filas relacionadas; el INSERT directo de
-- clinic_members del propio actor no está contemplado por las políticas.
-- ----------------------------------------------------------------------------
create or replace function public.create_clinic_with_admin(
  p_organization_id uuid,
  p_name text,
  p_slug text default null,
  p_email text default null,
  p_phone text default null,
  p_timezone text default 'America/Mexico_City',
  p_description text default null,
  p_address_line_1 text default null,
  p_address_line_2 text default null,
  p_neighborhood text default null,
  p_city text default null,
  p_state text default null,
  p_postal_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_clinic_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión para crear una clínica.'
      using errcode = '42501';
  end if;
  if not public.is_organization_admin(p_organization_id) then
    raise exception 'PERMISO_DENEGADO: solo administradores de la organización pueden crear clínicas.'
      using errcode = '42501';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'NOMBRE_REQUERIDO: el nombre de la clínica es obligatorio.'
      using errcode = '23514';
  end if;

  insert into public.clinics (
    organization_id, name, slug, email, phone, timezone, description,
    address_line_1, address_line_2, neighborhood, city, state, postal_code,
    created_by
  )
  values (
    p_organization_id,
    btrim(p_name),
    nullif(btrim(coalesce(p_slug, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    -- teléfono: se eliminan espacios y separadores para cumplir el CHECK E.164
    nullif(regexp_replace(coalesce(p_phone, ''), '[\s\-().]', '', 'g'), ''),
    coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), 'America/Mexico_City'),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_address_line_1, '')), ''),
    nullif(btrim(coalesce(p_address_line_2, '')), ''),
    nullif(btrim(coalesce(p_neighborhood, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_state, '')), ''),
    nullif(btrim(coalesce(p_postal_code, '')), ''),
    v_user
  )
  returning id into v_clinic_id;

  insert into public.clinic_members
    (clinic_id, user_id, role, status, joined_at, created_by)
  values (v_clinic_id, v_user, 'clinic_admin', 'active', now(), v_user);

  return v_clinic_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Reenviar una invitación pendiente: REEMPLAZA el token (el hash anterior se
-- sobreescribe, por lo que el enlace viejo queda inválido de inmediato) y
-- extiende la vigencia. Devuelve el token nuevo UNA sola vez.
-- Nunca se reconstruyen tokens desde hashes: se genera uno nuevo.
-- ----------------------------------------------------------------------------
create or replace function public.resend_clinic_invitation(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invitation public.clinic_invitations%rowtype;
  v_token text;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión para reenviar la invitación.'
      using errcode = '42501';
  end if;

  select * into v_invitation
  from public.clinic_invitations i
  where i.id = p_invitation_id
  for update;

  if not found then
    raise exception 'INVITACION_NO_ENCONTRADA: la invitación no existe.'
      using errcode = 'P0002';
  end if;
  if not (
    public.is_clinic_admin(v_invitation.clinic_id)
    or public.is_organization_admin(public.organization_of_clinic(v_invitation.clinic_id))
  ) then
    raise exception 'PERMISO_DENEGADO: solo administradores pueden reenviar invitaciones.'
      using errcode = '42501';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception 'INVITACION_NO_PENDIENTE: solo pueden reenviarse invitaciones pendientes.'
      using errcode = '23514';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.clinic_invitations
  set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      expires_at = now() + interval '7 days',
      invited_by = v_user
  where id = v_invitation.id;

  return v_token;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'create_clinic_with_admin(uuid, text, text, text, text, text, text, text, text, text, text, text, text)',
    'resend_clinic_invitation(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
