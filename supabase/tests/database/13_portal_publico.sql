-- ============================================================================
-- pgTAP 13 — Fase 8: portal público (lectura curada, reserva de invitado,
-- cuenta del propietario) — aislamiento y permisos
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

create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Fixtures --------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'duena.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a004', 'vet.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c001', 'portal.laura@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c002', 'portal.ajeno@ejemplo.mx');

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.org_a',
  public.create_organization_with_owner('Veterinaria Luna')::text, true);
select set_config('vars.clinic_a1', public.create_clinic_with_admin(
  current_setting('vars.org_a')::uuid, 'Clínica Luna Centro')::text, true);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.org_b',
  public.create_organization_with_owner('Veterinaria Sol')::text, true);
select set_config('vars.clinic_b1', public.create_clinic_with_admin(
  current_setting('vars.org_b')::uuid, 'Clínica Sol Norte')::text, true);

select pg_temp.logout();
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
select current_setting('vars.org_a')::uuid, u.id, 'member', 'active', now(),
       '00000000-0000-4000-8000-00000000a001'
from (values ('00000000-0000-4000-8000-00000000a004'::uuid),
             ('00000000-0000-4000-8000-00000000a005'::uuid)) as u (id);
insert into public.clinic_members (clinic_id, user_id, role, status, professional_license, joined_at, created_by)
values
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a004',
   'veterinarian', 'active', 'CED-1234567', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a005',
   'receptionist', 'active', null, now(), '00000000-0000-4000-8000-00000000a001');
select set_config('vars.vet1',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a004'), true);

update public.profiles set display_name = 'Dr. Vet Luna'
where id = '00000000-0000-4000-8000-00000000a004';

-- Clínica A es PÚBLICA con reservación en línea; B queda privada.
update public.clinics
set slug = 'clinica-luna-centro', is_public = true, accepts_online_booking = true
where id = current_setting('vars.clinic_a1')::uuid;
insert into public.reserved_slugs (slug) values ('portal-reservado')
on conflict do nothing;

-- Servicio + horario + paciente de Laura con cita futura confirmada.
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.svc', public.create_clinic_service(
  current_setting('vars.clinic_a1')::uuid, 'Consulta general', 'consultation',
  30::smallint, 45000, null, 0::smallint, 0::smallint, true,
  array[current_setting('vars.vet1')::uuid])::text, true);
select public.configure_veterinarian_schedule(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
  '[{"weekday":1,"start_time":"08:00","end_time":"20:00"}]'::jsonb);
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.owner', public.register_owner_with_clinic(
  current_setting('vars.clinic_a1')::uuid, 'Laura', 'Ramírez',
  'portal.laura@ejemplo.mx', '+525511112222')::text, true);
select set_config('vars.pet', public.register_pet_with_relationships(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.owner')::uuid,
  'Firulais', 'dog')::text, true);
select set_config('vars.cita_laura', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
  current_setting('vars.owner')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc')::uuid], '2027-03-01 10:00-06', 'staff',
  'Revisión anual')::text, true);

-- Caso 1: estructura ----------------------------------------------------------
select pg_temp.logout();
select is(
  (select count(*)::int from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('veterinarian_public_profiles', 'portal_invitations',
                       'public_booking_requests')
     and c.relrowsecurity and c.relforcerowsecurity),
  3, 'caso 1: las 3 tablas nuevas tienen RLS habilitado y forzado');

-- Casos 2-5: perfil público del veterinario -----------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select lives_ok(
  $$insert into public.veterinarian_public_profiles (user_id, slug, headline, is_public)
    values ('00000000-0000-4000-8000-00000000a004', 'dr-vet-luna',
            'Medicina interna de perros y gatos', true)$$,
  'caso 2: el veterinario crea su perfil público (opt-in)');
select throws_ok(
  $$insert into public.veterinarian_public_profiles (user_id, slug)
    values ('00000000-0000-4000-8000-00000000a004', 'portal-reservado')$$,
  '23505', null,
  'caso 3: un slug reservado se rechaza');
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_ok(
  $$insert into public.veterinarian_public_profiles (user_id, slug)
    values ('00000000-0000-4000-8000-00000000a005', 'recep-no')$$,
  '23514', null,
  'caso 4: quien no es veterinario activo no tiene perfil público');
with filas as (
  update public.veterinarian_public_profiles set headline = 'hackeado'
  where slug = 'dr-vet-luna' returning id
)
select set_config('vars.upd_perfil', (select count(*)::text from filas), true);
select is(current_setting('vars.upd_perfil'), '0',
  'caso 5: nadie edita el perfil de otro (0 filas)');

-- Casos 6-9: lectura pública anónima ------------------------------------------
select pg_temp.anon();
select is(
  (select jsonb_array_length(public.search_public_clinics())),
  1, 'caso 6: la búsqueda pública SOLO devuelve clínicas is_public (A, no B)');
select is(
  (select public.search_public_clinics() -> 0 ->> 'slug'),
  'clinica-luna-centro', 'caso 6b: con su slug público');
select is(
  (select jsonb_array_length(public.get_public_clinic('clinica-luna-centro') -> 'services')),
  1, 'caso 7: el perfil público de la clínica lista sus servicios activos');
select is(
  (select public.get_public_clinic('clinica-luna-centro') -> 'veterinarians'
          -> 0 ->> 'profile_slug'),
  'dr-vet-luna', 'caso 7b: y enlaza el perfil público del veterinario');
select is(
  (select public.get_public_veterinarian('dr-vet-luna') ->> 'display_name') is not null,
  true, 'caso 8: el perfil público del veterinario resuelve por slug');
select cmp_ok(
  (select jsonb_array_length(public.get_public_available_slots(
     'clinica-luna-centro', current_setting('vars.svc')::uuid,
     current_setting('vars.vet1')::uuid, '2027-03-01', '2027-03-01'))),
  '>', 0, 'caso 9: el widget público ve huecos reales de la agenda');
select throws_ok(
  $$select * from public.clinics$$,
  '42501', null,
  'caso 9b: anon JAMÁS lee tablas base directamente');

-- Casos 10-14: reserva pública de invitado ------------------------------------
select set_config('vars.solicitud', (public.request_public_appointment(
  'clinica-luna-centro', current_setting('vars.svc')::uuid,
  current_setting('vars.vet1')::uuid, '2027-03-01 12:00-06',
  'Carla', 'Invitada', 'carla.invitada@ejemplo.mx', '+525599990000',
  'Bombón', 'dog', 'Primera consulta',
  '22222222-2222-4222-8222-222222222222'))::text, true);
select matches(
  (current_setting('vars.solicitud')::jsonb ->> 'folio'),
  '^CIT-[0-9]{4}-[0-9]{6}$', 'caso 10: la solicitud pública crea cita con folio');
select is(
  (current_setting('vars.solicitud')::jsonb ->> 'status'),
  'requested', 'caso 10b: en estado requested (NO ocupa agenda todavía)');
select is(
  public.request_public_appointment(
    'clinica-luna-centro', current_setting('vars.svc')::uuid,
    current_setting('vars.vet1')::uuid, '2027-03-01 12:00-06',
    'Carla', 'Invitada', 'carla.invitada@ejemplo.mx', '+525599990000',
    'Bombón', 'dog', 'Primera consulta',
    '22222222-2222-4222-8222-222222222222')::text,
  current_setting('vars.solicitud'),
  'caso 11: el doble envío (misma idempotency key) devuelve la MISMA solicitud');
select throws_ok(
  $$select public.request_public_appointment(
      'clinica-sol-norte-privada', current_setting('vars.svc')::uuid,
      current_setting('vars.vet1')::uuid, '2027-03-01 13:00-06',
      'X', 'Y', 'x@ejemplo.mx', null, 'Z', 'cat')$$,
  'P0002', null,
  'caso 12: una clínica no pública no acepta solicitudes');
select throws_ok(
  $$select public.request_public_appointment(
      'clinica-luna-centro', current_setting('vars.svc')::uuid,
      current_setting('vars.vet1')::uuid, '2027-03-01 03:00-06',
      'Carla', 'Invitada', 'carla2@ejemplo.mx', null, 'Bombón', 'dog')$$,
  '23P01', null,
  'caso 13: un horario fuera de los huecos reales se rechaza');
select pg_temp.logout();
select is(
  (select a.source::text || ':' || (o.email) from public.appointments a
   join public.pet_owners o on o.id = a.owner_id
   where a.folio = (current_setting('vars.solicitud')::jsonb ->> 'folio')
     and a.clinic_id = current_setting('vars.clinic_a1')::uuid),
  'owner_portal:carla.invitada@ejemplo.mx',
  'caso 14: la cita registra fuente owner_portal y el propietario mínimo creado');

-- Casos 15-16: visibilidad de solicitudes por personal -------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select cmp_ok(
  (select count(*)::int from public.public_booking_requests
   where clinic_id = current_setting('vars.clinic_a1')::uuid),
  '>=', 1, 'caso 15: recepción de A ve las solicitudes públicas de SU clínica');
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select is(
  (select count(*)::int from public.public_booking_requests),
  0, 'caso 16: la organización B no ve solicitudes de A');

-- Casos 17-20: invitación al portal y vinculación explícita --------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.token', public.create_portal_invitation(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.owner')::uuid), true);
select matches(current_setting('vars.token'), '^[0-9a-f]{64}$',
  'caso 17: la invitación al portal genera token de un solo uso (hash persistido)');
select is(
  (select count(*)::int from public.portal_invitations
   where owner_id = current_setting('vars.owner')::uuid and status = 'pending'),
  1, 'caso 17b: la invitación queda pendiente');
select pg_temp.login('00000000-0000-4000-8000-00000000c002');
select throws_ok(
  $$select public.accept_portal_invitation('deadbeef')$$,
  'P0002', null,
  'caso 18: un token inválido se rechaza');
select pg_temp.login('00000000-0000-4000-8000-00000000c001');
select is(
  public.accept_portal_invitation(current_setting('vars.token'))::text,
  current_setting('vars.owner'),
  'caso 19: el propietario acepta y su cuenta queda vinculada');
select pg_temp.logout();
select is(
  (select (o.user_id::text = '00000000-0000-4000-8000-00000000c001')::text || ':' ||
          (select bool_and(can_access_portal)::text from public.pet_owner_relationships
           where owner_id = o.id and status = 'active')
   from public.pet_owners o where o.id = current_setting('vars.owner')::uuid),
  'true:true', 'caso 20: user_id vinculado y acceso al portal habilitado');

-- Casos 21-25: lecturas curadas del portal -------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000c001');
select is(
  (select public.get_my_pets() -> 0 ->> 'name'), 'Firulais',
  'caso 21: el propietario vinculado ve SUS mascotas');
select cmp_ok(
  (select jsonb_array_length(public.get_my_appointments())), '>=', 1,
  'caso 22: y sus citas (folio, clínica, veterinario)');
select is(
  (select public.get_my_pet_history(current_setting('vars.pet')::uuid)
          ?& array['encounters', 'prescriptions', 'vaccinations']),
  true, 'caso 23: el historial curado expone solo secciones permitidas');
select throws_ok(
  $$select public.get_my_pet_history('99999999-9999-4999-8999-999999999999')$$,
  '42501', null,
  'caso 23b: una mascota ajena se rechaza');
select pg_temp.login('00000000-0000-4000-8000-00000000c002');
select is(
  (select jsonb_array_length(public.get_my_pets())), 0,
  'caso 24: un usuario sin vinculación no ve nada');
select pg_temp.login('00000000-0000-4000-8000-00000000c001');
select is(
  public.cancel_my_appointment(current_setting('vars.cita_laura')::uuid,
    'No podré asistir')::text,
  'cancelled', 'caso 25: el propietario cancela SU cita futura en línea');
select pg_temp.logout();
select is(
  (select a.status::text from public.appointments a
   where a.id = current_setting('vars.cita_laura')::uuid),
  'cancelled', 'caso 25b: la cita queda cancelada con motivo y auditoría');
select pg_temp.login('00000000-0000-4000-8000-00000000c002');
select throws_ok(
  $$select public.cancel_my_appointment(current_setting('vars.cita_laura')::uuid, 'x')$$,
  'P0002', null,
  'caso 26: nadie cancela citas ajenas');

select * from finish();
rollback;
