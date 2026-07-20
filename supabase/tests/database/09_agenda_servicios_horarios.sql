-- ============================================================================
-- pgTAP 09 — Fase 5: servicios, horarios, excepciones y disponibilidad
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
  ('00000000-0000-4000-8000-00000000a001', 'duena.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a004', 'vet.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a006', 'asistente.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a007', 'vet2.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx');

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
             ('00000000-0000-4000-8000-00000000a005'::uuid),
             ('00000000-0000-4000-8000-00000000a006'::uuid),
             ('00000000-0000-4000-8000-00000000a007'::uuid)) as u (id);
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a004',
   'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a005',
   'receptionist', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a006',
   'assistant', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a007',
   'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a001');

select set_config('vars.vet1',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a004'), true);
select set_config('vars.vet2',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a007'), true);
select set_config('vars.recep_member',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a005'), true);

-- Catálogo de servicios (casos 1-7) -------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.svc30', public.create_clinic_service(
  current_setting('vars.clinic_a1')::uuid, 'Consulta general', 'consultation',
  30::smallint, 50000, 'Consulta de rutina', 0::smallint, 0::smallint, true,
  array[current_setting('vars.vet1')::uuid]
)::text, true);
select is(
  (select count(*)::int from public.clinic_services
   where id = current_setting('vars.svc30')::uuid and active),
  1, 'caso 1: la administración crea servicios del catálogo'
);
select is(
  (select count(*)::int from public.clinic_service_veterinarians
   where clinic_service_id = current_setting('vars.svc30')::uuid),
  1, 'caso 1b: el veterinario asignado queda registrado'
);
select throws_like(
  $$select public.create_clinic_service(current_setting('vars.clinic_a1')::uuid,
      '  consulta GENERAL ', 'consultation', 20::smallint, 10000)$$,
  '%SERVICIO_DUPLICADO%',
  'caso 2: no hay dos servicios activos con el mismo nombre (normalizado)'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_like(
  $$select public.create_clinic_service(current_setting('vars.clinic_a1')::uuid,
      'Cirugía', 'surgery', 60::smallint, 200000)$$,
  '%PERMISO_DENEGADO%',
  'caso 3: un veterinario no configura el catálogo'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select throws_like(
  $$select public.create_clinic_service(current_setting('vars.clinic_a1')::uuid,
      'Intruso', 'other', 30::smallint, 1000)$$,
  '%PERMISO_DENEGADO%',
  'caso 4: la organización B no crea servicios en la clínica A'
);
select is(
  (select count(*)::int from public.clinic_services
   where clinic_id = current_setting('vars.clinic_a1')::uuid),
  0, 'caso 5: la organización B no ve el catálogo de la clínica A'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_like(
  $$insert into public.clinic_service_veterinarians (clinic_service_id, clinic_member_id)
    values (current_setting('vars.svc30')::uuid, current_setting('vars.recep_member')::uuid)$$,
  '%MIEMBRO_NO_VETERINARIO%',
  'caso 6: una recepcionista no puede asignarse como veterinaria de un servicio'
);
select pg_temp.logout();
select set_config('vars.vet_b',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_b1')::uuid limit 1), true);
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_like(
  $$insert into public.clinic_service_veterinarians (clinic_service_id, clinic_member_id)
    values (current_setting('vars.svc30')::uuid, current_setting('vars.vet_b')::uuid)$$,
  '%MIEMBRO_NO_VETERINARIO%',
  'caso 7: un miembro de otra clínica no puede prestar el servicio'
);

-- Horarios (casos 8-12) --------------------------------------------------------
select is(
  public.configure_veterinarian_schedule(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
    '[{"weekday":1,"start_time":"09:00","end_time":"14:00"},
      {"weekday":2,"start_time":"09:00","end_time":"13:00"}]'::jsonb),
  2, 'caso 8: la administración configura el horario semanal (2 ventanas)'
);
select throws_like(
  $$select public.configure_veterinarian_schedule(
      current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet2')::uuid,
      '[{"weekday":1,"start_time":"09:00","end_time":"12:00"},
        {"weekday":1,"start_time":"11:00","end_time":"15:00"}]'::jsonb)$$,
  '%HORARIO_TRASLAPADO%',
  'caso 9: dos ventanas del mismo día que se cruzan se rechazan (EXCLUDE)'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_like(
  $$select public.configure_veterinarian_schedule(
      current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
      '[{"weekday":3,"start_time":"09:00","end_time":"12:00"}]'::jsonb)$$,
  '%PERMISO_DENEGADO%',
  'caso 10: una recepcionista no configura horarios'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_like(
  $$select public.configure_veterinarian_schedule(
      current_setting('vars.clinic_a1')::uuid, current_setting('vars.recep_member')::uuid,
      '[{"weekday":1,"start_time":"09:00","end_time":"12:00"}]'::jsonb)$$,
  '%MIEMBRO_NO_VETERINARIO%',
  'caso 11: solo los veterinarios tienen agenda propia'
);
select public.configure_veterinarian_schedule(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet2')::uuid,
  '[{"weekday":4,"start_time":"10:00","end_time":"18:00"}]'::jsonb);
select is(
  public.configure_veterinarian_schedule(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet2')::uuid,
    '[{"weekday":5,"start_time":"08:00","end_time":"12:00"}]'::jsonb),
  1, 'caso 12: reconfigurar reemplaza el horario…'
);
select is(
  (select count(*)::int from public.veterinarian_schedules
   where clinic_member_id = current_setting('vars.vet2')::uuid and active),
  1, 'caso 12b: …y las ventanas anteriores quedan inactivas (con rastro)'
);

-- Excepciones (casos 13-17) ----------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select lives_ok(
  $$insert into public.schedule_exceptions
      (organization_id, clinic_id, clinic_member_id, type, starts_at, ends_at, reason)
    values (current_setting('vars.org_a')::uuid, current_setting('vars.clinic_a1')::uuid,
            current_setting('vars.vet1')::uuid, 'vacation',
            '2027-04-05 00:00-06', '2027-04-10 00:00-06', 'Vacaciones')$$,
  'caso 13: un veterinario registra sus propias excepciones'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_ok(
  $$insert into public.schedule_exceptions
      (organization_id, clinic_id, clinic_member_id, type, starts_at, ends_at)
    values (current_setting('vars.org_a')::uuid, current_setting('vars.clinic_a1')::uuid,
            current_setting('vars.vet1')::uuid, 'personal',
            '2027-04-12 00:00-06', '2027-04-13 00:00-06')$$,
  '42501', null,
  'caso 14: una recepcionista no registra excepciones ajenas'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_ok(
  $$insert into public.schedule_exceptions
      (organization_id, clinic_id, clinic_member_id, type, starts_at, ends_at)
    values (current_setting('vars.org_a')::uuid, current_setting('vars.clinic_a1')::uuid,
            current_setting('vars.vet1')::uuid, 'clinic_closure',
            '2027-04-14 00:00-06', '2027-04-15 00:00-06')$$,
  '23514', null,
  'caso 15: un cierre de clínica no admite miembro específico'
);
select throws_ok(
  $$insert into public.schedule_exceptions
      (organization_id, clinic_id, type, starts_at, ends_at)
    values (current_setting('vars.org_a')::uuid, current_setting('vars.clinic_a1')::uuid,
            'special_hours', '2027-04-16 09:00-06', '2027-04-16 12:00-06')$$,
  '23514', null,
  'caso 16: un horario especial requiere un profesional concreto'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select is(
  (select count(*)::int from public.veterinarian_schedules
   where clinic_id = current_setting('vars.clinic_a1')::uuid),
  0, 'caso 17: la organización B no ve horarios de la clínica A'
);

-- Disponibilidad (casos 18-21) -------------------------------------------------
-- Lunes 2027-03-08, ventana 09:00-14:00 local, servicio de 30 min, rejilla 15:
-- 19 inicios posibles (09:00 … 13:30).
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select is(
  (select count(*)::int from public.get_available_slots(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
    current_setting('vars.svc30')::uuid, '2027-03-08', '2027-03-08')),
  19, 'caso 18: los slots respetan ventana, duración y rejilla de 15 minutos'
);
select is(
  (select min(slot_start)::text from public.get_available_slots(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
    current_setting('vars.svc30')::uuid, '2027-03-08', '2027-03-08')),
  '2027-03-08 09:00:00-06'::timestamptz::text,
  'caso 18b: el primer slot abre la ventana en hora local de la clínica'
);
-- Bloqueo parcial del martes 2027-03-09 (ventana 09:00-13:00): al bloquear
-- 09:00-11:00 quedan 7 inicios (11:00 … 12:30).
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
insert into public.schedule_exceptions
  (organization_id, clinic_id, clinic_member_id, type, starts_at, ends_at, reason)
values (current_setting('vars.org_a')::uuid, current_setting('vars.clinic_a1')::uuid,
        current_setting('vars.vet1')::uuid, 'training',
        '2027-03-09 09:00-06', '2027-03-09 11:00-06', 'Capacitación');
select is(
  (select count(*)::int from public.get_available_slots(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
    current_setting('vars.svc30')::uuid, '2027-03-09', '2027-03-09')),
  7, 'caso 19: las excepciones bloqueantes recortan la disponibilidad'
);
select throws_like(
  $$select * from public.get_available_slots(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
    current_setting('vars.svc30')::uuid, '2027-03-01', '2027-05-01')$$,
  '%RANGO_EXCESIVO%',
  'caso 20: la consulta de disponibilidad se limita a 31 días'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select throws_like(
  $$select * from public.get_available_slots(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
    current_setting('vars.svc30')::uuid, '2027-03-08', '2027-03-08')$$,
  '%PERMISO_DENEGADO%',
  'caso 21: la organización B no consulta disponibilidad de la clínica A'
);

select * from finish();
rollback;
