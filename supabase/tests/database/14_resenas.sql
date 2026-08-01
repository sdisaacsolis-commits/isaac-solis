-- ============================================================================
-- pgTAP 14 — Fase 8.1: reseñas verificadas (verificación por cita, moderación)
-- ============================================================================
begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
declare v_email text;
begin
  perform set_config('role', 'none', true);
  select u.email into v_email from auth.users u where u.id = p_user;
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'email', v_email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end; $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end; $$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end; $$;

-- Fixtures --------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'duena.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a004', 'vet.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c001', 'propietario.laura@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c002', 'ajeno@ejemplo.mx');

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.org_a',
  public.create_organization_with_owner('Veterinaria Luna')::text, true);
select set_config('vars.clinic_a1', public.create_clinic_with_admin(
  current_setting('vars.org_a')::uuid, 'Clínica Luna Centro')::text, true);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.org_b',
  public.create_organization_with_owner('Veterinaria Sol')::text, true);

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
update public.clinics set slug = 'clinica-luna-centro', is_public = true,
  accepts_online_booking = true, city = 'Ciudad de México'
where id = current_setting('vars.clinic_a1')::uuid;

-- Servicio, horario, propietario (vinculado a cuenta), mascota, cita COMPLETADA.
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
  'propietario.laura@ejemplo.mx', '+525511112222')::text, true);
select set_config('vars.pet', public.register_pet_with_relationships(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.owner')::uuid,
  'Firulais', 'dog')::text, true);
select set_config('vars.cita', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
  current_setting('vars.owner')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc')::uuid], '2027-03-01 10:00-06', 'staff',
  'Revisión anual')::text, true);
-- Segunda cita NO completada (confirmada) para probar el rechazo.
select set_config('vars.cita2', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
  current_setting('vars.owner')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc')::uuid], '2027-03-08 10:00-06', 'staff',
  'Seguimiento')::text, true);
-- Atención y cierre los realiza el veterinario (registrar la atención es acto clínico).
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select public.transition_appointment_status(current_setting('vars.cita')::uuid, 'checked_in');
select public.transition_appointment_status(current_setting('vars.cita')::uuid, 'in_progress');
select public.transition_appointment_status(current_setting('vars.cita')::uuid, 'completed');
-- Vincular la cuenta del propietario (como haría accept_portal_invitation).
select pg_temp.logout();
update public.pet_owners set user_id = '00000000-0000-4000-8000-00000000c001'
where id = current_setting('vars.owner')::uuid;
update public.pet_owner_relationships set can_access_portal = true
where owner_id = current_setting('vars.owner')::uuid;

-- Caso 1: estructura ----------------------------------------------------------
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('reviews', 'review_moderation_events')
     and c.relrowsecurity and c.relforcerowsecurity),
  2, 'caso 1: las 2 tablas nuevas tienen RLS habilitado y forzado');

-- Casos 2-6: enviar reseña ----------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000c002');
select throws_ok(
  format($$select public.submit_review(%L, 5::smallint, 'Excelente atención')$$,
    current_setting('vars.cita')),
  'P0002', null, 'caso 2: no puedes reseñar una cita que no es tuya');
select pg_temp.login('00000000-0000-4000-8000-00000000c001');
select throws_ok(
  format($$select public.submit_review(%L, 5::smallint, 'Buena')$$, current_setting('vars.cita2')),
  '23514', null, 'caso 3: no se reseña una cita no completada');
select throws_ok(
  format($$select public.submit_review(%L, 9::smallint, 'x')$$, current_setting('vars.cita')),
  '22023', null, 'caso 4: la calificación fuera de 1–5 se rechaza');
select set_config('vars.review', public.submit_review(
  current_setting('vars.cita')::uuid, 5::smallint,
  'Trato excelente y explicación clara', 'Muy recomendable')::text, true);
select is(
  (select rating::int from public.reviews where id = current_setting('vars.review')::uuid),
  5, 'caso 5: el propietario que asistió deja su reseña verificada');
select throws_ok(
  format($$select public.submit_review(%L, 4::smallint, 'otra vez')$$, current_setting('vars.cita')),
  '23505', null, 'caso 6: una cita solo admite UNA reseña');

-- Caso 7: agregado de calificación --------------------------------------------
select pg_temp.logout();
select is(
  (public.clinic_rating(current_setting('vars.clinic_a1')::uuid) ->> 'count'),
  '1', 'caso 7: el promedio de la clínica cuenta la reseña publicada');
select is(
  (public.clinic_rating(current_setting('vars.clinic_a1')::uuid) ->> 'average'),
  '5.00', 'caso 7b: con el promedio correcto');

-- Casos 8-10: lectura pública anónima -----------------------------------------
select pg_temp.anon();
select is(
  (select jsonb_array_length(
     public.get_clinic_reviews('clinica-luna-centro') -> 'reviews')),
  1, 'caso 8: el sitio público muestra la reseña publicada');
select is(
  (select public.get_clinic_reviews('clinica-luna-centro') -> 'reviews' -> 0 ->> 'author'),
  'Laura R.', 'caso 8b: el autor se muestra enmascarado (nombre + inicial)');
select throws_ok(
  $$select * from public.reviews$$, '42501', null,
  'caso 9: anon jamás lee la tabla de reseñas directamente');
select is(
  (select public.search_public_clinics() -> 0 -> 'rating' ->> 'count'),
  '1', 'caso 10: la búsqueda pública incluye el promedio de calificación');

-- Casos 11-12: respuesta y reporte de la clínica ------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select lives_ok(
  format($$select public.reply_to_review(%L, 'Gracias por tu confianza, Laura.')$$,
    current_setting('vars.review')),
  'caso 11: la clínica responde públicamente la reseña');
select is(
  (select public.get_clinic_reviews('clinica-luna-centro') -> 'reviews' -> 0 ->> 'clinic_reply'),
  'Gracias por tu confianza, Laura.',
  'caso 11b: la respuesta de la clínica es pública');
select lives_ok(
  format($$select public.report_review(%L, 'Contenido presuntamente falso')$$,
    current_setting('vars.review')),
  'caso 12: la clínica reporta (deja rastro, no oculta)');
select is(
  (public.clinic_rating(current_setting('vars.clinic_a1')::uuid) ->> 'count'),
  '1', 'caso 12b: reportar NO oculta la reseña (sigue contando)');

-- Casos 13-16: moderación elevada (ocultar/restaurar) -------------------------
select throws_ok(
  format($$select public.set_review_visibility(%L, true, 'ofensiva')$$, current_setting('vars.review')),
  '42501', null, 'caso 13: recepción no oculta reseñas (permiso elevado)');
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_ok(
  format($$select public.set_review_visibility(%L, true, '  ')$$, current_setting('vars.review')),
  '22023', null, 'caso 14: ocultar exige motivo');
select is(
  public.set_review_visibility(current_setting('vars.review')::uuid, true,
    'Lenguaje ofensivo')::text,
  'hidden', 'caso 15: administración de la organización oculta con motivo');
select pg_temp.logout();
select is(
  (public.clinic_rating(current_setting('vars.clinic_a1')::uuid) ->> 'count'),
  '0', 'caso 15b: la reseña oculta sale del promedio público');
select is(
  (select body from public.reviews where id = current_setting('vars.review')::uuid),
  'Trato excelente y explicación clara',
  'caso 16: ocultar NO borra el contenido de la reseña');
select pg_temp.anon();
select is(
  (select jsonb_array_length(public.get_clinic_reviews('clinica-luna-centro') -> 'reviews')),
  0, 'caso 16b: el público ya no ve la reseña oculta');

-- Casos 17-18: restaurar y editar la propia -----------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select is(
  public.set_review_visibility(current_setting('vars.review')::uuid, false, 'Revisada')::text,
  'published', 'caso 17: se puede restaurar (moderación con motivo y auditoría)');
select pg_temp.login('00000000-0000-4000-8000-00000000c001');
select lives_ok(
  format($$select public.update_my_review(%L, 4::smallint, 'Ajusto mi opinión tras el seguimiento')$$,
    current_setting('vars.review')),
  'caso 18: el propietario edita su propia reseña dentro de la ventana');
select is(
  (select rating::int from public.reviews where id = current_setting('vars.review')::uuid),
  4, 'caso 18b: la calificación quedó actualizada');

-- Casos 19-22: aislamiento, historial y permisos ------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select is(
  (select count(*)::int from public.reviews), 0,
  'caso 19: la organización B no ve reseñas de A');
select throws_ok(
  format($$select public.reply_to_review(%L, 'intento ajeno')$$, current_setting('vars.review')),
  '42501', null, 'caso 20: personal de otra clínica no responde reseñas ajenas');
select pg_temp.login('00000000-0000-4000-8000-00000000c002');
select throws_ok(
  format($$select public.update_my_review(%L, 1::smallint, 'sabotaje')$$, current_setting('vars.review')),
  'P0002', null, 'caso 21: nadie edita la reseña de otra persona');
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_ok(
  $$update public.review_moderation_events set reason = 'x'$$, '42501', null,
  'caso 22: el historial de moderación es append-only para clientes (sin grant de UPDATE)');
select cmp_ok(
  (select count(*)::int from public.review_moderation_events
   where review_id = current_setting('vars.review')::uuid), '>=', 4,
  'caso 22b: cada acción de moderación (replied/reported/hidden/restored) deja rastro');
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select is(
  (select jsonb_array_length(public.get_my_reviewable_appointments())), 0,
  'caso 23: get_my_reviewable_appointments es del propietario, no del personal');

select * from finish();
rollback;
