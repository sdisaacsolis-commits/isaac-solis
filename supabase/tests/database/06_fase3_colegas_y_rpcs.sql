-- ============================================================================
-- pgTAP 06 — Fase 3: visibilidad de colegas, create_clinic_with_admin y reenvío
-- ============================================================================
begin;
set search_path = public, extensions;
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
  ('00000000-0000-4000-8000-00000000a001', 'duena.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a004', 'vet.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c002', 'nuevo@ejemplo.mx');

update public.profiles set display_name = 'Ana Aguilar', phone = '+525511111111'
where id = '00000000-0000-4000-8000-00000000a001';

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.org_a',
  public.create_organization_with_owner('Veterinaria Luna')::text, true);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.org_b',
  public.create_organization_with_owner('Veterinaria Sol')::text, true);

-- create_clinic_with_admin ----------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.clinic_a1', public.create_clinic_with_admin(
  current_setting('vars.org_a')::uuid, 'Clínica Luna Centro', null,
  'Contacto@Luna.MX', '+52 55 1234 5678', 'America/Mexico_City',
  null, 'Av. Reforma 100', null, 'Juárez', 'CDMX', 'Ciudad de México', '06600'
)::text, true);
select is(
  (select count(*)::int from public.clinics
   where id = current_setting('vars.clinic_a1')::uuid and status = 'trial'),
  1,
  'create_clinic_with_admin crea la clínica en estado trial'
);
select is(
  (select count(*)::int from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a001'
     and role = 'clinic_admin' and status = 'active'),
  1,
  'el creador queda como clinic_admin activo en la misma transacción'
);
select is(
  (select email from public.clinics where id = current_setting('vars.clinic_a1')::uuid),
  'contacto@luna.mx',
  'el correo de la clínica se normaliza a minúsculas'
);

-- personal de la clínica A (vet + recepción) para las pruebas siguientes
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
select current_setting('vars.org_a')::uuid, u.id, 'member', 'active', now(),
       '00000000-0000-4000-8000-00000000a001'
from (values ('00000000-0000-4000-8000-00000000a004'::uuid),
             ('00000000-0000-4000-8000-00000000a005'::uuid)) as u (id);
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a004',
   'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a005',
   'receptionist', 'active', now(), '00000000-0000-4000-8000-00000000a001');

select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_like(
  $$select public.create_clinic_with_admin(current_setting('vars.org_a')::uuid, 'Pirata')$$,
  '%PERMISO_DENEGADO%',
  'un miembro sin rol admin no puede crear clínicas vía RPC'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select throws_like(
  $$select public.create_clinic_with_admin(current_setting('vars.org_a')::uuid, 'Intrusa')$$,
  '%PERMISO_DENEGADO%',
  'el owner de la organización B no puede crear clínicas en la organización A'
);

-- Vista de colegas ------------------------------------------------------------
select columns_are('public', 'colleague_profiles',
  array['id', 'display_name', 'first_name', 'last_name', 'avatar_url'],
  'la vista de colegas expone SOLO columnas básicas (sin teléfono ni banderas)');

select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select is(
  (select count(*)::int from public.colleague_profiles
   where id = '00000000-0000-4000-8000-00000000a001'),
  1,
  'un veterinario ve el perfil básico de una colega de su organización'
);
select is(
  (select display_name from public.colleague_profiles
   where id = '00000000-0000-4000-8000-00000000a001'),
  'Ana Aguilar',
  'la vista devuelve el nombre para mostrar'
);
select is(
  (select count(*)::int from public.colleague_profiles
   where id = '00000000-0000-4000-8000-00000000b001'),
  0,
  'NO se filtran perfiles de otras organizaciones por la vista'
);
select is(
  (select count(*)::int from public.profiles
   where id = '00000000-0000-4000-8000-00000000a001'),
  0,
  'la tabla profiles sigue cerrada: los colegas solo se ven por la vista'
);

select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select is(
  (select count(*)::int from public.colleague_profiles
   where id in ('00000000-0000-4000-8000-00000000a001',
                '00000000-0000-4000-8000-00000000a004')),
  0,
  'la organización B no ve perfil alguno de la organización A'
);

-- Reenvío de invitaciones -----------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.token1',
  public.invite_clinic_member(current_setting('vars.clinic_a1')::uuid,
    'nuevo@ejemplo.mx', 'assistant'), true);
select set_config('vars.inv_id',
  (select id::text from public.clinic_invitations
   where email = 'nuevo@ejemplo.mx' and status = 'pending'), true);

select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_like(
  $$select public.resend_clinic_invitation(current_setting('vars.inv_id')::uuid)$$,
  '%PERMISO_DENEGADO%',
  'una recepcionista no puede reenviar invitaciones'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.token2',
  public.resend_clinic_invitation(current_setting('vars.inv_id')::uuid), true);
select matches(current_setting('vars.token2'), '^[0-9a-f]{64}$',
  'el reenvío genera un token nuevo de 64 hex');
select isnt(current_setting('vars.token2'), current_setting('vars.token1'),
  'el token nuevo es distinto del anterior');
select is(
  (select count(*)::int from public.clinic_invitations
   where email = 'nuevo@ejemplo.mx' and status = 'pending'),
  1,
  'el reenvío NO duplica invitaciones pendientes'
);

select pg_temp.login('00000000-0000-4000-8000-00000000c002');
select throws_like(
  $$select public.accept_clinic_invitation(current_setting('vars.token1'))$$,
  '%INVITACION_NO_ENCONTRADA%',
  'el token anterior queda inválido tras el reenvío'
);
select is(
  public.accept_clinic_invitation(current_setting('vars.token2')),
  current_setting('vars.clinic_a1')::uuid,
  'el token nuevo sí permite aceptar la invitación'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_like(
  $$select public.resend_clinic_invitation(current_setting('vars.inv_id')::uuid)$$,
  '%INVITACION_NO_PENDIENTE%',
  'una invitación aceptada ya no puede reenviarse'
);

select * from finish();
rollback;
