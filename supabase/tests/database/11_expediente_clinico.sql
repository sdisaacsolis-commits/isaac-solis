-- ============================================================================
-- pgTAP 11 — Fase 6: expediente clínico (aislamiento, roles, inmutabilidad)
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
  ('00000000-0000-4000-8000-00000000a004', 'vet.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a006', 'asistente.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a008', 'suspendida.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b002', 'vet.b@ejemplo.mx');
update public.profiles set is_superadmin = true
where id = '00000000-0000-4000-8000-00000000f001';

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
select current_setting('vars.org_a')::uuid, u.id, 'member', u.st, now(),
       '00000000-0000-4000-8000-00000000a001'
from (values ('00000000-0000-4000-8000-00000000a004'::uuid, 'active'::public.membership_status),
             ('00000000-0000-4000-8000-00000000a005'::uuid, 'active'),
             ('00000000-0000-4000-8000-00000000a006'::uuid, 'active'),
             ('00000000-0000-4000-8000-00000000a008'::uuid, 'active')) as u (id, st);
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.org_b')::uuid, '00000000-0000-4000-8000-00000000b002',
        'member', 'active', now(), '00000000-0000-4000-8000-00000000b001');
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a004',
   'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a005',
   'receptionist', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a006',
   'assistant', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a008',
   'veterinarian', 'suspended', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_b1')::uuid, '00000000-0000-4000-8000-00000000b002',
   'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000b001');
select set_config('vars.vet1',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a004'), true);
select set_config('vars.vet_b',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_b1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000b002'), true);

-- Agenda mínima + paciente (compartido entre A y B para probar aislamiento).
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.svc', public.create_clinic_service(
  current_setting('vars.clinic_a1')::uuid, 'Consulta general', 'consultation',
  30::smallint, 50000, null, 0::smallint, 0::smallint, true,
  array[current_setting('vars.vet1')::uuid])::text, true);
select public.configure_veterinarian_schedule(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.vet1')::uuid,
  '[{"weekday":1,"start_time":"08:00","end_time":"20:00"}]'::jsonb);
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.owner', public.register_owner_with_clinic(
  current_setting('vars.clinic_a1')::uuid, 'Laura', 'Ramírez',
  'laura@ejemplo.mx', '+525511112222')::text, true);
select set_config('vars.pet', public.register_pet_with_relationships(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.owner')::uuid,
  'Firulais', 'dog')::text, true);
-- La clínica B también atiende a la mascota (mascota compartida).
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.owner_b', public.register_owner_with_clinic(
  current_setting('vars.clinic_b1')::uuid, 'Laura', 'Ramírez', null, null)::text, true);
select pg_temp.logout();
insert into public.clinic_pet_relationships (organization_id, clinic_id, pet_id, status, source)
values (current_setting('vars.org_b')::uuid, current_setting('vars.clinic_b1')::uuid,
        current_setting('vars.pet')::uuid, 'active', 'manual');

-- Cita confirmada (lunes 2027-03-01 10:00 local).
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.cita', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
  current_setting('vars.owner')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc')::uuid], '2027-03-01 10:00-06', 'staff',
  'Revisión anual')::text, true);
select public.transition_appointment_status(current_setting('vars.cita')::uuid, 'checked_in');

-- Casos 1-4: apertura desde cita, idempotencia y única consulta por cita -------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select set_config('vars.enc', public.start_encounter_from_appointment(
  current_setting('vars.cita')::uuid)::text, true);
select matches(
  (select folio from public.clinical_encounters where id = current_setting('vars.enc')::uuid),
  '^CON-[0-9]{4}-000001$', 'caso 1: la consulta nace con folio CON-AAAA-NNNNNN');
select is(
  public.start_encounter_from_appointment(current_setting('vars.cita')::uuid)::text,
  current_setting('vars.enc'),
  'caso 2: reabrir desde la misma cita es idempotente (misma consulta)');
select is(
  (select count(*)::int from public.clinical_encounters
   where appointment_id = current_setting('vars.cita')::uuid),
  1, 'caso 3: una cita origina exactamente una consulta activa');
select is(
  (select status::text from public.appointments where id = current_setting('vars.cita')::uuid),
  'in_progress', 'caso 4: al abrir la consulta la cita pasa a in_progress');

-- Casos 5-8: contenido clínico y roles ----------------------------------------
select lives_ok(
  $$insert into public.clinical_notes (encounter_id, subjective, assessment, plan)
    values (current_setting('vars.enc')::uuid, 'Dueña reporta apatía',
            'Gastroenteritis leve', 'Dieta blanda 5 días')$$,
  'caso 5: el veterinario captura la nota SOAP');
select lives_ok(
  $$insert into public.encounter_examinations (encounter_id, general_condition, oral_cavity)
    values (current_setting('vars.enc')::uuid, 'Alerta', 'Sin hallazgos')$$,
  'caso 5b: el veterinario captura la exploración');
select lives_ok(
  $$insert into public.diagnoses (encounter_id, name, certainty, is_primary)
    values (current_setting('vars.enc')::uuid, 'Gastroenteritis', 'presumptive', true)$$,
  'caso 6: diagnóstico principal registrado');
select throws_ok(
  $$insert into public.diagnoses (encounter_id, name, is_primary)
    values (current_setting('vars.enc')::uuid, 'Otro principal', true)$$,
  '23505', null, 'caso 6b: máximo un diagnóstico principal activo');
select lives_ok(
  $$insert into public.encounter_treatments (encounter_id, treatment_type, name, dosage_text)
    values (current_setting('vars.enc')::uuid, 'medication_recommendation',
            'Omeprazol', '1 mg/kg cada 24 h')$$,
  'caso 7: tratamiento registrado');
select pg_temp.login('00000000-0000-4000-8000-00000000a006');
select lives_ok(
  $$insert into public.clinical_vitals (encounter_id, weight_kg, temperature_c)
    values (current_setting('vars.enc')::uuid, 12.400, 38.5)$$,
  'caso 8: la asistente captura signos vitales');
select throws_ok(
  $$insert into public.diagnoses (encounter_id, name)
    values (current_setting('vars.enc')::uuid, 'Intento de asistente')$$,
  '42501', null, 'caso 8b: la asistente NO diagnostica');

-- Casos 9-12: privacidad de recepción y aislamiento ----------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select is(
  (select count(*)::int from public.clinical_encounters
   where id = current_setting('vars.enc')::uuid),
  1, 'caso 9: recepción ve la cabecera administrativa');
select is(
  (select count(*)::int from public.clinical_notes
   where encounter_id = current_setting('vars.enc')::uuid),
  0, 'caso 9b: recepción NO ve la nota clínica');
with filas as (
  update public.clinical_notes set plan = 'hackeo'
  where encounter_id = current_setting('vars.enc')::uuid
  returning id
)
select set_config('vars.upd_recep', (select count(*)::text from filas), true);
select is(current_setting('vars.upd_recep'), '0',
  'caso 10: recepción no edita contenido clínico (RLS: 0 filas)');
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from public.clinical_encounters
   where pet_id = current_setting('vars.pet')::uuid),
  0, 'caso 11: la clínica B no ve consultas de la clínica A (mascota compartida)');
select is(
  (select count(*)::int from public.clinical_notes),
  0, 'caso 11b: la clínica B no ve notas de la clínica A');
select pg_temp.login('00000000-0000-4000-8000-00000000a008');
select is(
  (select count(*)::int from public.clinical_encounters),
  0, 'caso 12: un miembro suspendido no accede al expediente');

-- Caso 13: control optimista ---------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
with filas as (
  update public.clinical_notes set plan = 'Dieta blanda 7 días'
  where encounter_id = current_setting('vars.enc')::uuid and version = 1
  returning id
)
select set_config('vars.upd_v1', (select count(*)::text from filas), true);
select is(current_setting('vars.upd_v1'), '1',
  'caso 13: la edición con versión vigente aplica (y sube la versión)');
with filas as (
  update public.clinical_notes set plan = 'sobrescritura perdida'
  where encounter_id = current_setting('vars.enc')::uuid and version = 1
  returning id
)
select set_config('vars.upd_v2', (select count(*)::text from filas), true);
select is(current_setting('vars.upd_v2'), '0',
  'caso 13b: una versión obsoleta afecta 0 filas (conflicto detectable)');
select is(
  (select version from public.clinical_notes
   where encounter_id = current_setting('vars.enc')::uuid),
  2, 'caso 13c: la versión se incrementa en la base, no en el cliente');

-- Casos 14-16: requisitos mínimos y finalización -------------------------------
-- (la cita traía motivo; se limpia para probar el requisito mínimo)
update public.clinical_encounters set chief_complaint = null
where id = current_setting('vars.enc')::uuid;
select throws_like(
  $$select public.finalize_clinical_encounter(current_setting('vars.enc')::uuid)$$,
  '%FALTA_MOTIVO%', 'caso 14: sin motivo de consulta no se finaliza');
update public.clinical_encounters
set chief_complaint = 'Apatía y vómito desde ayer'
where id = current_setting('vars.enc')::uuid;
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_like(
  $$select public.finalize_clinical_encounter(current_setting('vars.enc')::uuid)$$,
  '%PERMISO_DENEGADO%', 'caso 15: recepción no finaliza');
select pg_temp.login('00000000-0000-4000-8000-00000000a006');
select throws_like(
  $$select public.finalize_clinical_encounter(current_setting('vars.enc')::uuid)$$,
  '%PERMISO_DENEGADO%', 'caso 15b: la asistente no finaliza');
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select is(
  public.finalize_clinical_encounter(current_setting('vars.enc')::uuid)::text,
  'finalized', 'caso 16: el veterinario responsable finaliza');
select is(
  public.finalize_clinical_encounter(current_setting('vars.enc')::uuid)::text,
  'finalized', 'caso 16b: finalizar dos veces es idempotente');
select is(
  (select status::text from public.appointments where id = current_setting('vars.cita')::uuid),
  'completed', 'caso 16c: la cita vinculada queda completada');
select ok(
  (select last_visit_at is not null from public.clinic_pet_relationships
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and pet_id = current_setting('vars.pet')::uuid),
  'caso 16d: la fecha de visita se actualizó');

-- Casos 17-19: inmutabilidad total tras finalizar ------------------------------
-- Capa RLS (cliente): las políticas de edición dejan de ver la fila → 0 filas.
with filas as (
  update public.clinical_notes set plan = 'edición tardía'
  where encounter_id = current_setting('vars.enc')::uuid
  returning id
)
select set_config('vars.upd_fin', (select count(*)::text from filas), true);
select is(current_setting('vars.upd_fin'), '0',
  'caso 17: la nota final es inmutable para el cliente (RLS: 0 filas)');
select throws_like(
  $$insert into public.clinical_vitals (encounter_id, weight_kg)
    values (current_setting('vars.enc')::uuid, 12.5)$$,
  '%CONSULTA_INMUTABLE%', 'caso 17b: no se agregan vitales a una consulta finalizada');
with filas as (
  update public.diagnoses set name = 'cambiado'
  where encounter_id = current_setting('vars.enc')::uuid
  returning id
)
select set_config('vars.upd_dx', (select count(*)::text from filas), true);
select is(current_setting('vars.upd_dx'), '0', 'caso 17c: diagnósticos congelados (RLS)');
with filas as (
  update public.clinical_encounters set chief_complaint = 'reescrito'
  where id = current_setting('vars.enc')::uuid
  returning id
)
select set_config('vars.upd_cab', (select count(*)::text from filas), true);
select is(current_setting('vars.upd_cab'), '0',
  'caso 18: ni la cabecera clínica se edita tras finalizar (RLS)');
-- Capa de triggers (segunda línea: aplica aunque un rol evada RLS).
select pg_temp.logout();
select throws_like(
  $$update public.clinical_notes set plan = 'edición privilegiada'
    where encounter_id = current_setting('vars.enc')::uuid$$,
  '%CONSULTA_INMUTABLE%',
  'caso 18b: el trigger bloquea la edición incluso sin RLS (defensa en profundidad)');
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_ok(
  $$update public.encounter_status_history set to_status = 'in_progress'$$,
  '42501', null, 'caso 19: el historial de estados es append-only');

-- Casos 20-21: adendas ----------------------------------------------------------
select lives_ok(
  $$insert into public.encounter_addenda (encounter_id, content, reason)
    values (current_setting('vars.enc')::uuid,
            'Corrección: la dosis correcta es 0.5 mg/kg.', 'Error de captura')$$,
  'caso 20: adenda sobre consulta finalizada');
select throws_ok(
  $$update public.encounter_addenda set content = 'alterada'$$,
  '42501', null, 'caso 20b: las adendas no se editan');
select throws_ok(
  $$delete from public.encounter_addenda$$,
  '42501', null, 'caso 20c: las adendas no se eliminan');
select pg_temp.logout();
select set_config('vars.enc2', null, true);
-- Adenda sobre consulta abierta debe fallar: creamos una segunda consulta.
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select set_config('vars.enc2', public.create_walk_in_encounter(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
  current_setting('vars.owner')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc')::uuid], 'walk_in', 'Cojea de pata trasera')::text, true);
select throws_like(
  $$insert into public.encounter_addenda (encounter_id, content, reason)
    values (current_setting('vars.enc2')::uuid, 'x', 'y')$$,
  '%ADENDA_INVALIDA%', 'caso 21: no hay adendas sobre consultas abiertas');

-- Casos 22-24: walk-in y archivos ------------------------------------------------
select is(
  (select encounter_type::text from public.clinical_encounters
   where id = current_setting('vars.enc2')::uuid),
  'walk_in', 'caso 22: el walk-in crea consulta con cita interna checked_in→in_progress');
select is(
  (select a.status::text from public.appointments a
   join public.clinical_encounters e on e.appointment_id = a.id
   where e.id = current_setting('vars.enc2')::uuid),
  'in_progress', 'caso 22b: la cita interna del walk-in queda en atención');
select set_config('vars.file_path',
  format('pets/%s/encounters/%s/%s.pdf', current_setting('vars.pet'),
         current_setting('vars.enc2'), gen_random_uuid()), true);
select lives_ok(
  $$insert into public.clinical_files
      (organization_id, clinic_id, pet_id, encounter_id, storage_path, original_filename,
       mime_type, size_bytes, kind)
    values (current_setting('vars.org_a')::uuid, current_setting('vars.clinic_a1')::uuid,
            current_setting('vars.pet')::uuid, current_setting('vars.enc2')::uuid,
            current_setting('vars.file_path'), 'laboratorio.pdf', 'application/pdf',
            1024, 'laboratory_result')$$,
  'caso 23: el veterinario registra un archivo clínico');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner)
    values ('clinical-files', current_setting('vars.file_path'),
            '00000000-0000-4000-8000-00000000a004')$$,
  'caso 23b: la política de Storage permite subir al expediente propio');
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'clinical-files'),
  0, 'caso 24: la clínica B no ve archivos clínicos de A (anti-IDOR)');
select is(
  (select count(*)::int from public.clinical_files),
  0, 'caso 24b: tampoco la metadata');

-- Casos 25-27: anulación ---------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_like(
  $$select public.void_clinical_encounter(current_setting('vars.enc')::uuid, 'error')$$,
  '%PERMISO_DENEGADO%', 'caso 25: un veterinario no anula (permiso elevado)');
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_like(
  $$select public.void_clinical_encounter(current_setting('vars.enc')::uuid, '  ')$$,
  '%MOTIVO_REQUERIDO%', 'caso 25b: anular exige motivo');
select is(
  public.void_clinical_encounter(current_setting('vars.enc')::uuid,
    'Se vinculó al paciente equivocado')::text,
  'voided', 'caso 26: administración de la organización anula con motivo');
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select is(
  (select plan from public.clinical_notes
   where encounter_id = current_setting('vars.enc')::uuid),
  'Dieta blanda 7 días', 'caso 26b: la anulación conserva el contenido');
select throws_like(
  $$insert into public.encounter_addenda (encounter_id, content, reason)
    values (current_setting('vars.enc')::uuid, 'x', 'y')$$,
  '%ADENDA_INVALIDA%', 'caso 27: una consulta anulada tampoco admite adendas');

-- Casos 28-30: superficie mínima y superadmin ------------------------------------
select throws_ok(
  $$update public.clinical_encounters set status = 'finalized'
    where id = current_setting('vars.enc2')::uuid$$,
  '42501', null, 'caso 28: el estado no es editable directamente (solo RPC)');
select throws_ok(
  $$insert into public.clinical_encounters
      (organization_id, clinic_id, clinic_pet_relationship_id, pet_id,
       responsible_veterinarian_clinic_member_id, folio)
    select organization_id, clinic_id, clinic_pet_relationship_id, pet_id,
       responsible_veterinarian_clinic_member_id, 'CON-2027-999999'
    from public.clinical_encounters where id = current_setting('vars.enc2')::uuid$$,
  '42501', null, 'caso 28b: no hay INSERT directo de consultas');
select throws_ok(
  $$select * from public.clinical_folio_counters$$,
  '42501', null, 'caso 29: los contadores de folio no son consultables');
select pg_temp.login('00000000-0000-4000-8000-00000000f001');
select ok(
  (select count(*) > 0 from public.clinical_encounters),
  'caso 30: el superadmin conserva acceso explícito y auditable');

-- Caso 31: la auditoría clínica NO duplica contenido ------------------------------
select pg_temp.logout();
select is(
  (select count(*)::int from public.audit_log
   where entity_type = 'clinical_notes'
     and (coalesce(new_data::text, '') like '%Dieta blanda%'
          or coalesce(old_data::text, '') like '%Dieta blanda%')),
  0, 'caso 31: audit_log no contiene el contenido clínico (redactado)');
select ok(
  (select count(*) > 0 from public.audit_log where entity_type = 'clinical_notes'),
  'caso 31b: pero sí registra que la nota cambió');

select * from finish();
rollback;
