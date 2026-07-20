-- ============================================================================
-- pgTAP 05 — Invitaciones (tokens hasheados) y bitácora de auditoría
-- ============================================================================
begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
declare
  v_email text;
begin
  perform set_config('role', 'none', true);
  select u.email into v_email from auth.users u where u.id = p_user;
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', v_email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Fixtures --------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000f001', 'super@dogtoralia.mx'),
  ('00000000-0000-4000-8000-00000000a001', 'duena.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a003', 'admin.clinica.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c002', 'nuevo@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c003', 'otro@ejemplo.mx');

update public.profiles set is_superadmin = true
where id = '00000000-0000-4000-8000-00000000f001';

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.org_a',
  public.create_organization_with_owner('Veterinaria Luna')::text, true);
with c as (
  insert into public.clinics (organization_id, name, created_by)
  values (current_setting('vars.org_a')::uuid, 'Clínica Luna Centro',
          '00000000-0000-4000-8000-00000000a001')
  returning id
)
select set_config('vars.clinic_a1', (select id from c)::text, true);
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.org_a')::uuid, '00000000-0000-4000-8000-00000000a003',
   'member', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.org_a')::uuid, '00000000-0000-4000-8000-00000000a005',
   'member', 'active', now(), '00000000-0000-4000-8000-00000000a001');
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a003',
   'clinic_admin', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a005',
   'receptionist', 'active', now(), '00000000-0000-4000-8000-00000000a001');

select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.org_b',
  public.create_organization_with_owner('Veterinaria Sol')::text, true);

-- Emisión de invitaciones ------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a003');
select set_config('vars.token1',
  public.invite_clinic_member(current_setting('vars.clinic_a1')::uuid,
    ' Nuevo@Ejemplo.MX ', 'receptionist'), true);
select matches(current_setting('vars.token1'), '^[0-9a-f]{64}$',
  'la RPC devuelve un token aleatorio de 64 hex');
select is(
  (select email from public.clinic_invitations
   where clinic_id = current_setting('vars.clinic_a1')::uuid and status = 'pending'),
  'nuevo@ejemplo.mx',
  'el correo se normaliza a minúsculas y sin espacios'
);
select throws_like(
  $$select public.invite_clinic_member(current_setting('vars.clinic_a1')::uuid,
      'nuevo@ejemplo.mx', 'receptionist')$$,
  '%INVITACION_DUPLICADA%',
  'no se permiten invitaciones pendientes duplicadas (correo+clínica+rol)'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_like(
  $$select public.invite_clinic_member(current_setting('vars.clinic_a1')::uuid,
      'alguien@ejemplo.mx', 'assistant')$$,
  '%PERMISO_DENEGADO%',
  'una recepcionista no puede invitar'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select throws_like(
  $$select public.invite_clinic_member(current_setting('vars.clinic_a1')::uuid,
      'alguien@ejemplo.mx', 'assistant')$$,
  '%PERMISO_DENEGADO%',
  'el owner de la organización B no puede invitar a la clínica A'
);

-- El token nunca se guarda en claro y token_hash es ilegible -------------------
select pg_temp.logout();
select is(
  (select token_hash from public.clinic_invitations
   where email = 'nuevo@ejemplo.mx' and status = 'pending'),
  encode(digest(current_setting('vars.token1'), 'sha256'), 'hex'),
  'solo se persiste el hash SHA-256 del token'
);
select isnt(
  (select token_hash from public.clinic_invitations
   where email = 'nuevo@ejemplo.mx' and status = 'pending'),
  current_setting('vars.token1'),
  'el token en claro no está almacenado'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a003');
select throws_ok(
  $$select token_hash from public.clinic_invitations$$,
  '42501',
  null,
  'token_hash es ilegible para clientes (privilegio de columna)'
);
select is(
  (select count(*)::int from public.clinic_invitations
   where clinic_id = current_setting('vars.clinic_a1')::uuid),
  1,
  'el admin de clínica consulta las columnas permitidas de sus invitaciones'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select is(
  (select count(*)::int from public.clinic_invitations),
  0,
  'una recepcionista no ve invitación alguna'
);

-- Aceptación -------------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000c003');
select throws_like(
  $$select public.accept_clinic_invitation(current_setting('vars.token1'))$$,
  '%CORREO_NO_COINCIDE%',
  'la invitación solo puede aceptarla el correo invitado'
);
select pg_temp.login('00000000-0000-4000-8000-00000000c002');
select is(
  public.accept_clinic_invitation(current_setting('vars.token1')),
  current_setting('vars.clinic_a1')::uuid,
  'la persona invitada acepta con el token y recibe el id de la clínica'
);
select throws_like(
  $$select public.accept_clinic_invitation(current_setting('vars.token1'))$$,
  '%INVITACION_NO_ENCONTRADA%',
  'un token aceptado no puede reutilizarse'
);
select pg_temp.logout();
select is(
  (select count(*)::int from public.organization_members
   where organization_id = current_setting('vars.org_a')::uuid
     and user_id = '00000000-0000-4000-8000-00000000c002'
     and role = 'member' and status = 'active'),
  1,
  'aceptar crea la membresía de organización (member activo) en la misma transacción'
);
select is(
  (select count(*)::int from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000c002'
     and role = 'receptionist' and status = 'active'),
  1,
  'aceptar crea la membresía de clínica con el rol invitado'
);
select is(
  (select status::text from public.clinic_invitations where email = 'nuevo@ejemplo.mx'),
  'accepted',
  'la invitación queda marcada como aceptada'
);

-- Invitaciones vencidas ---------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a003');
select set_config('vars.token2',
  public.invite_clinic_member(current_setting('vars.clinic_a1')::uuid,
    'otro@ejemplo.mx', 'veterinarian'), true);
select pg_temp.logout();
update public.clinic_invitations
set expires_at = now() - interval '1 hour'
where email = 'otro@ejemplo.mx' and status = 'pending';
select pg_temp.login('00000000-0000-4000-8000-00000000c003');
select throws_like(
  $$select public.accept_clinic_invitation(current_setting('vars.token2'))$$,
  '%INVITACION_VENCIDA%',
  'una invitación vencida no puede aceptarse'
);

-- Revocación --------------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a003');
select set_config('vars.token3',
  public.invite_clinic_member(current_setting('vars.clinic_a1')::uuid,
    'tercero@ejemplo.mx', 'assistant'), true);
select lives_ok(
  $$update public.clinic_invitations set status = 'revoked'
    where email = 'tercero@ejemplo.mx' and status = 'pending'$$,
  'un admin revoca una invitación pendiente'
);
select set_config('vars.token4',
  public.invite_clinic_member(current_setting('vars.clinic_a1')::uuid,
    'cuarto@ejemplo.mx', 'assistant'), true);
select throws_ok(
  $$update public.clinic_invitations set status = 'accepted'
    where email = 'cuarto@ejemplo.mx' and status = 'pending'$$,
  '42501',
  null,
  'un cliente no puede marcar invitaciones como aceptadas (solo revocar)'
);

-- Auditoría ---------------------------------------------------------------------
select pg_temp.logout();
select ok(
  (select count(*) > 0 from public.audit_log
   where entity_type = 'organizations' and action = 'insert'
     and organization_id = current_setting('vars.org_a')::uuid),
  'la creación de organizaciones queda auditada'
);
select ok(
  (select count(*) > 0 from public.audit_log
   where entity_type = 'clinic_members' and action = 'insert'
     and clinic_id = current_setting('vars.clinic_a1')::uuid),
  'las altas de membresías de clínica quedan auditadas'
);
select is(
  (select count(*)::int from public.audit_log
   where entity_type = 'clinic_invitations'
     and (coalesce(new_data, '{}'::jsonb) ? 'token_hash'
          or coalesce(old_data, '{}'::jsonb) ? 'token_hash')),
  0,
  'la bitácora JAMÁS contiene token_hash'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select ok(
  (select count(*) > 0 from public.audit_log
   where organization_id = current_setting('vars.org_a')::uuid),
  'el owner consulta la bitácora de su organización'
);
select is(
  (select count(*)::int from public.audit_log
   where organization_id = current_setting('vars.org_b')::uuid),
  0,
  'el owner de A no ve bitácora de la organización B'
);
select throws_ok(
  $$update public.audit_log set action = 'alterada'$$,
  '42501', null, 'audit_log es append-only: sin UPDATE para clientes'
);
select throws_ok(
  $$delete from public.audit_log$$,
  '42501', null, 'audit_log es append-only: sin DELETE para clientes'
);
select throws_ok(
  $$insert into public.audit_log (action, entity_type) values ('falsa', 'x')$$,
  '42501', null, 'los clientes no insertan en audit_log directamente'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select is(
  (select count(*)::int from public.audit_log),
  0,
  'una recepcionista no ve la bitácora'
);

select pg_temp.login('00000000-0000-4000-8000-00000000f001');
select ok(
  (select count(*) > 0 from public.audit_log
   where organization_id = current_setting('vars.org_b')::uuid),
  'el superadmin accede a la bitácora global mediante política explícita'
);

select * from finish();
rollback;
