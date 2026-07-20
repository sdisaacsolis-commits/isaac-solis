-- ============================================================================
-- pgTAP 10 — Fase 5: citas (folio, anti-traslape, estados, notificaciones)
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
             ('00000000-0000-4000-8000-00000000a006'::uuid)) as u (id);
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a004',
   'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a005',
   'receptionist', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a006',
   'assistant', 'active', now(), '00000000-0000-4000-8000-00000000a001');

select set_config('vars.vet1',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a004'), true);

-- Catálogo, horario, propietario y mascota.
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.svc30', public.create_clinic_service(
  current_setting('vars.clinic_a1')::uuid, 'Consulta general', 'consultation',
  30::smallint, 50000, null, 0::smallint, 0::smallint, true,
  array[current_setting('vars.vet1')::uuid])::text, true);
select set_config('vars.svc_buffer', public.create_clinic_service(
  current_setting('vars.clinic_a1')::uuid, 'Cirugía menor', 'surgery',
  60::smallint, 250000, null, 0::smallint, 30::smallint, true,
  array[current_setting('vars.vet1')::uuid])::text, true);
select public.configure_veterinarian_schedule(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
  '[{"weekday":1,"start_time":"09:00","end_time":"18:00"}]'::jsonb);

select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.owner_a', public.register_owner_with_clinic(
  current_setting('vars.clinic_a1')::uuid, 'Laura', 'Ramírez',
  'laura@ejemplo.mx', '+525511112222')::text, true);
select set_config('vars.pet_a', public.register_pet_with_relationships(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.owner_a')::uuid,
  'Firulais', 'dog')::text, true);

select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.owner_b', public.register_owner_with_clinic(
  current_setting('vars.clinic_b1')::uuid, 'Bruno', 'Blanco', null, null)::text, true);
select set_config('vars.pet_b', public.register_pet_with_relationships(
  current_setting('vars.clinic_b1')::uuid, current_setting('vars.owner_b')::uuid,
  'Sol', 'cat')::text, true);

-- Folio y agendamiento (casos 1-3) --------------------------------------------
-- Lunes 2027-03-01, 10:00 hora local (America/Mexico_City, UTC-6).
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.cita1', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
  current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc30')::uuid],
  '2027-03-01 10:00-06', 'staff', 'Revisión anual')::text, true);
select is(
  (select folio from public.appointments where id = current_setting('vars.cita1')::uuid),
  'CIT-2027-000001',
  'caso 1: el folio es secuencial por clínica y año (CIT-AAAA-NNNNNN)'
);
select is(
  (select status::text from public.appointments where id = current_setting('vars.cita1')::uuid),
  'confirmed', 'caso 1b: una cita agendada por personal nace confirmada'
);
select set_config('vars.cita2', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
  current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc30')::uuid],
  '2027-03-01 11:00-06', 'phone')::text, true);
select is(
  (select folio from public.appointments where id = current_setting('vars.cita2')::uuid),
  'CIT-2027-000002', 'caso 2: el folio incrementa sin COUNT(*)+1'
);
select is(
  (select service_name from public.appointment_services
   where appointment_id = current_setting('vars.cita1')::uuid),
  'Consulta general', 'caso 3: la cita guarda snapshot del servicio'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
update public.clinic_services set price_cents = 99999
where id = current_setting('vars.svc30')::uuid;
select is(
  (select price_cents from public.appointment_services
   where appointment_id = current_setting('vars.cita1')::uuid),
  50000, 'caso 3b: cambiar el catálogo NO altera el precio pactado (snapshot)'
);

-- Anti-traslape (casos 4-7) ----------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_like(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-01 10:15-06')$$,
  '%HORARIO_OCUPADO%',
  'caso 4: dos citas del mismo profesional no pueden cruzarse (EXCLUDE)'
);
select lives_ok(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-01 10:30-06')$$,
  'caso 5: una cita contigua (fin = inicio) sí es válida (rango semiabierto)'
);
-- La cirugía deja 30 min de colchón posterior: 12:00-13:00 ocupa hasta 13:30.
select public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
  current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc_buffer')::uuid], '2027-03-01 12:00-06');
select throws_like(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-01 13:00-06')$$,
  '%HORARIO_OCUPADO%',
  'caso 6: los colchones del servicio también ocupan agenda'
);
select set_config('vars.cita_cancelable', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
  current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc30')::uuid], '2027-03-01 15:00-06')::text, true);
select public.cancel_appointment(
  current_setting('vars.cita_cancelable')::uuid, 'La propietaria no puede asistir');
select lives_ok(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-01 15:00-06')$$,
  'caso 7: una cita cancelada libera el horario'
);

-- Horario laboral, urgencias y walk-in (casos 8-10) -----------------------------
select throws_like(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-02 10:00-06')$$,
  '%FUERA_DE_HORARIO%',
  'caso 8: no se agenda fuera del horario del profesional (martes sin ventana)'
);
select throws_like(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-02 10:00-06', 'staff',
    null, true, null)$$,
  '%MOTIVO_REQUERIDO%',
  'caso 9: una urgencia exige motivo'
);
select lives_ok(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-02 10:00-06', 'staff',
    null, true, 'Atropellamiento, atención inmediata')$$,
  'caso 9b: la urgencia con motivo puede ir fuera de horario (queda auditada)'
);
select set_config('vars.walkin', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
  current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc30')::uuid], now() + interval '5 minutes',
  'walk_in')::text, true);
select is(
  (select status::text from public.appointments
   where id = current_setting('vars.walkin')::uuid),
  'checked_in', 'caso 10: un walk-in nace recibido (checked_in) sin exigir horario'
);
select ok(
  (select checked_in_at is not null from public.appointments
   where id = current_setting('vars.walkin')::uuid),
  'caso 10b: el walk-in registra su hora de llegada'
);

-- Aislamiento y permisos (casos 11-14) -----------------------------------------
select throws_like(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_b')::uuid,
    current_setting('vars.owner_b')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-01 16:00-06')$$,
  '%MASCOTA_SIN_RELACION%',
  'caso 11: no se agenda una mascota sin relación activa con la clínica'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a006');
select throws_like(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-01 16:00-06')$$,
  '%PERMISO_DENEGADO%',
  'caso 12: el personal asistente no agenda citas'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select throws_like(
  $$select public.book_appointment(
    current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
    current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
    array[current_setting('vars.svc30')::uuid], '2027-03-01 16:00-06')$$,
  '%PERMISO_DENEGADO%',
  'caso 13: la organización B no agenda en la clínica A'
);
select is(
  (select count(*)::int from public.appointments
   where clinic_id = current_setting('vars.clinic_a1')::uuid),
  0, 'caso 14: la organización B no ve citas de la clínica A'
);
select is(
  (select count(*)::int from public.appointment_services aps
   where aps.appointment_id = current_setting('vars.cita1')::uuid),
  0, 'caso 14b: tampoco ve los servicios de esas citas'
);

-- Máquina de estados (casos 15-20) ---------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select is(
  (select count(*)::int from public.appointment_status_history
   where appointment_id = current_setting('vars.cita1')::uuid
     and from_status is null and to_status = 'confirmed'),
  1, 'caso 15: la creación queda en el historial (∅ → confirmed)'
);
select throws_like(
  $$select public.transition_appointment_status(
    current_setting('vars.cita1')::uuid, 'in_progress')$$,
  '%TRANSICION_INVALIDA%',
  'caso 16: confirmed → in_progress sin check-in es inválida'
);
select is(
  public.transition_appointment_status(current_setting('vars.cita1')::uuid, 'checked_in')::text,
  'checked_in', 'caso 17: la recepción registra la llegada (confirmed → checked_in)'
);
select throws_like(
  $$select public.transition_appointment_status(
    current_setting('vars.cita1')::uuid, 'in_progress')$$,
  '%PERMISO_DENEGADO%',
  'caso 18: la recepción NO inicia la atención (acto clínico)'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select public.transition_appointment_status(current_setting('vars.cita1')::uuid, 'in_progress');
select is(
  public.transition_appointment_status(current_setting('vars.cita1')::uuid, 'completed')::text,
  'completed', 'caso 19: el veterinario completa la atención'
);
select throws_like(
  $$select public.transition_appointment_status(
    current_setting('vars.cita1')::uuid, 'confirmed')$$,
  '%TRANSICION_INVALIDA%',
  'caso 20: completed es terminal'
);
select ok(
  (select completed_at is not null and started_at is not null from public.appointments
   where id = current_setting('vars.cita1')::uuid),
  'caso 20b: los hitos operativos quedan sellados'
);

-- Efectos de completar (caso 21) ------------------------------------------------
select ok(
  (select last_visit_at is not null and first_visit_at is not null
   from public.clinic_pet_relationships
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and pet_id = current_setting('vars.pet_a')::uuid),
  'caso 21: completar la cita actualiza first/last_visit_at de la relación'
);

-- Cancelación (casos 22-23) ------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_like(
  $$select public.cancel_appointment(current_setting('vars.cita2')::uuid, '  ')$$,
  '%MOTIVO_REQUERIDO%',
  'caso 22: cancelar exige motivo'
);
select public.cancel_appointment(current_setting('vars.cita2')::uuid, 'Reagendará después');
select is(
  (select cancellation_reason from public.appointments
   where id = current_setting('vars.cita2')::uuid),
  'Reagendará después', 'caso 22b: el motivo queda en la cita'
);
select is(
  (select count(*)::int from public.appointment_status_history
   where appointment_id = current_setting('vars.cita2')::uuid
     and to_status = 'cancelled' and reason = 'Reagendará después'),
  1, 'caso 23: la cancelación queda en el historial con motivo'
);

-- Reagendamiento (casos 24-26) ----------------------------------------------------
select set_config('vars.cita3', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
  current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc30')::uuid], '2027-03-08 09:00-06')::text, true);
select set_config('vars.folio3',
  (select folio from public.appointments where id = current_setting('vars.cita3')::uuid), true);
select is(
  public.reschedule_appointment(current_setting('vars.cita3')::uuid,
    '2027-03-08 12:00-06', null, 'Conflicto de la propietaria')::text,
  current_setting('vars.cita3'),
  'caso 24: reagendar conserva la identidad (mismo id)'
);
select is(
  (select folio from public.appointments where id = current_setting('vars.cita3')::uuid),
  current_setting('vars.folio3'),
  'caso 24b: reagendar conserva el folio'
);
select is(
  (select scheduled_start::text from public.appointments
   where id = current_setting('vars.cita3')::uuid),
  '2027-03-08 12:00:00-06'::timestamptz::text,
  'caso 24c: la cita quedó en el nuevo horario'
);
select throws_like(
  $$select public.reschedule_appointment(current_setting('vars.cita1')::uuid,
    '2027-03-08 16:00-06')$$,
  '%ESTADO_INVALIDO%',
  'caso 25: una cita completada no se reagenda'
);
select set_config('vars.cita4', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet_a')::uuid,
  current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc30')::uuid], '2027-03-08 13:00-06')::text, true);
select throws_like(
  $$select public.reschedule_appointment(current_setting('vars.cita3')::uuid,
    '2027-03-08 13:15-06')$$,
  '%HORARIO_OCUPADO%',
  'caso 26: reagendar tampoco puede traslapar (EXCLUDE)'
);

-- Notificaciones (casos 27-29) -----------------------------------------------------
select is(
  (select count(*)::int from public.appointment_notifications
   where appointment_id = current_setting('vars.cita4')::uuid
     and type in ('confirmation', 'reminder_24h', 'reminder_2h')
     and status = 'pending'),
  3, 'caso 27: agendar encola confirmación y recordatorios 24h/2h'
);
select is(
  (select count(*)::int from public.appointment_notifications
   where appointment_id = current_setting('vars.cita3')::uuid
     and type in ('reminder_24h', 'reminder_2h') and status = 'pending'),
  2, 'caso 27c: tras reagendar, los recordatorios vigentes son los del nuevo horario'
);
select is(
  (select count(*)::int from public.appointment_notifications
   where appointment_id = current_setting('vars.cita3')::uuid
     and type = 'reschedule'),
  1, 'caso 27b: reagendar encola el aviso de cambio'
);
select is(
  (select count(*)::int from public.appointment_notifications
   where appointment_id = current_setting('vars.cita2')::uuid
     and type in ('reminder_24h', 'reminder_2h') and status = 'cancelled'),
  2, 'caso 28: cancelar la cita cancela sus recordatorios pendientes'
);
select is(
  (select count(*)::int from public.appointment_notifications
   where appointment_id = current_setting('vars.cita2')::uuid
     and type = 'cancellation' and status = 'pending'),
  1, 'caso 28b: y encola el aviso de cancelación'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select is(
  (select count(*)::int from public.appointment_notifications),
  0, 'caso 29: la organización B no ve notificaciones de la clínica A'
);

-- Superficie mínima (casos 30-33) ----------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_ok(
  $$insert into public.appointments
      (organization_id, clinic_id, folio, pet_id, owner_id,
       veterinarian_clinic_member_id, scheduled_start, scheduled_end,
       occupies_from, occupies_until)
    values (current_setting('vars.org_a')::uuid, current_setting('vars.clinic_a1')::uuid,
            'CIT-2027-999999', current_setting('vars.pet_a')::uuid,
            current_setting('vars.owner_a')::uuid, current_setting('vars.vet1')::uuid,
            '2027-03-01 17:00-06', '2027-03-01 17:30-06',
            '2027-03-01 17:00-06', '2027-03-01 17:30-06')$$,
  '42501', null,
  'caso 30: ni la administración inserta citas directamente (solo RPC)'
);
select throws_ok(
  $$update public.appointments set status = 'cancelled'
    where id = current_setting('vars.cita3')::uuid$$,
  '42501', null,
  'caso 31: tampoco hay UPDATE directo de citas'
);
select throws_ok(
  $$update public.appointment_status_history set reason = 'alterado'$$,
  '42501', null,
  'caso 32: el historial de estados es append-only'
);
select throws_ok(
  $$select * from public.appointment_folio_counters$$,
  '42501', null,
  'caso 33: los contadores de folio no son consultables por clientes'
);

-- El superadmin conserva acceso explícito (caso 34) ------------------------------
select pg_temp.logout();
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000f001', 'super@dogtoralia.mx');
update public.profiles set is_superadmin = true
where id = '00000000-0000-4000-8000-00000000f001';
select pg_temp.login('00000000-0000-4000-8000-00000000f001');
select ok(
  (select count(*) > 0 from public.appointments),
  'caso 34: el superadmin consulta citas mediante política explícita'
);

select * from finish();
rollback;
