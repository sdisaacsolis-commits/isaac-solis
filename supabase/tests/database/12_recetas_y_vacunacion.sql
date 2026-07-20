-- ============================================================================
-- pgTAP 12 — Fase 7: recetas y vacunación (aislamiento, roles, inmutabilidad)
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
insert into public.clinic_members (clinic_id, user_id, role, status, professional_license, joined_at, created_by)
values
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a004',
   'veterinarian', 'active', 'CED-1234567', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a005',
   'receptionist', 'active', null, now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a006',
   'assistant', 'active', null, now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a008',
   'veterinarian', 'suspended', null, now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_b1')::uuid, '00000000-0000-4000-8000-00000000b002',
   'veterinarian', 'active', null, now(), '00000000-0000-4000-8000-00000000b001');
select set_config('vars.vet1',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a004'), true);
select set_config('vars.vet_b',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_b1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000b002'), true);

-- Agenda mínima + paciente compartido entre A y B.
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
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.owner_b', public.register_owner_with_clinic(
  current_setting('vars.clinic_b1')::uuid, 'Laura', 'Ramírez', null, null)::text, true);
select pg_temp.logout();
insert into public.clinic_pet_relationships (organization_id, clinic_id, pet_id, status, source)
values (current_setting('vars.org_b')::uuid, current_setting('vars.clinic_b1')::uuid,
        current_setting('vars.pet')::uuid, 'active', 'manual');
insert into public.pet_owner_relationships (pet_id, owner_id, relationship_type, is_primary, status)
values (current_setting('vars.pet')::uuid, current_setting('vars.owner_b')::uuid,
        'guardian', false, 'active');

-- Consulta clínica finalizable (cita lunes 2027-03-01 10:00 local).
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.cita', public.book_appointment(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
  current_setting('vars.owner')::uuid, current_setting('vars.vet1')::uuid,
  array[current_setting('vars.svc')::uuid], '2027-03-01 10:00-06', 'staff',
  'Revisión anual')::text, true);
select public.transition_appointment_status(current_setting('vars.cita')::uuid, 'checked_in');
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select set_config('vars.enc', public.start_encounter_from_appointment(
  current_setting('vars.cita')::uuid)::text, true);
select lives_ok(
  $$insert into public.clinical_notes (encounter_id, assessment, plan)
    values (current_setting('vars.enc')::uuid, 'Otitis externa', 'Tratamiento tópico 10 días')$$,
  'fixture: nota clínica con evaluación y plan');
select lives_ok(
  $$update public.clinical_encounters
    set examination_skipped_reason = 'Paciente agresivo',
        vitals_skipped_reason = 'Paciente agresivo'
    where id = current_setting('vars.enc')::uuid$$,
  'fixture: omisiones justificadas de exploración y vitales');

-- Caso 1: estructura — RLS habilitado Y forzado en todas las tablas nuevas ----
select pg_temp.logout();
select is(
  (select count(*)::int from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('prescriptions', 'prescription_items', 'prescription_status_history',
                       'prescription_documents', 'prescription_folio_counters',
                       'vaccines_catalog', 'vaccination_records', 'vaccination_status_history',
                       'vaccination_documents', 'vaccination_notifications')
     and c.relrowsecurity and c.relforcerowsecurity),
  10, 'caso 1: las 10 tablas nuevas tienen RLS habilitado y forzado');

-- Casos 2-5: borrador de receta y roles ---------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select set_config('vars.rx', public.create_prescription_draft(
  current_setting('vars.enc')::uuid)::text, true);
select is(
  (select status::text from public.prescriptions where id = current_setting('vars.rx')::uuid),
  'draft', 'caso 2: el veterinario prepara un borrador durante la consulta abierta');
select lives_ok(
  $$insert into public.prescription_items
      (prescription_id, position, medication_name, dosage_text, route_text, frequency_text,
       duration_text, instructions)
    values (current_setting('vars.rx')::uuid, 1, 'Amoxicilina suspensión',
            '12 mg/kg', 'Oral', 'Cada 12 horas', '10 días', 'Administrar con alimento')$$,
  'caso 3: el veterinario captura una partida con dosis en texto');
select lives_ok(
  $$insert into public.prescription_items
      (prescription_id, position, medication_name, dosage_text, route_text, frequency_text,
       duration_text)
    values (current_setting('vars.rx')::uuid, 2, 'Limpiador ótico',
            'Según indicación', 'Tópica', 'Cada 24 horas', '10 días')$$,
  'caso 3b: segunda partida conserva su orden');
select throws_ok(
  $$select public.issue_prescription(current_setting('vars.rx')::uuid)$$,
  '23514', null,
  'caso 4: no se emite con la consulta abierta (CONSULTA_NO_FINALIZADA)');
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_ok(
  $$select public.create_prescription_draft(current_setting('vars.enc')::uuid)$$,
  '42501', null,
  'caso 5: recepción no crea recetas clínicas');

-- Casos 6-8: visibilidad de borradores por rol --------------------------------
select is(
  (select count(*)::int from public.prescriptions
   where id = current_setting('vars.rx')::uuid),
  0, 'caso 6: recepción NO ve borradores en preparación');
select pg_temp.login('00000000-0000-4000-8000-00000000a006');
select is(
  (select count(*)::int from public.prescriptions
   where id = current_setting('vars.rx')::uuid),
  1, 'caso 7: el personal clínico (asistente) sí ve el borrador');
select throws_ok(
  $$select public.issue_prescription(current_setting('vars.rx')::uuid)$$,
  '42501', null,
  'caso 8: el asistente no emite recetas');

-- Casos 9-12: emisión (consulta finalizada, folio, snapshots, documento) ------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select is(
  public.finalize_clinical_encounter(current_setting('vars.enc')::uuid)::text,
  'finalized', 'fixture: la consulta queda finalizada');
select set_config('vars.folio1',
  public.issue_prescription(current_setting('vars.rx')::uuid), true);
select matches(current_setting('vars.folio1'), '^REC-[0-9]{4}-000001$',
  'caso 9: la receta emitida obtiene folio REC-AAAA-NNNNNN');
select is(
  public.issue_prescription(current_setting('vars.rx')::uuid),
  current_setting('vars.folio1'),
  'caso 10: repetir la emisión es idempotente (mismo folio, sin duplicados)');
select is(
  (select count(*)::int from public.prescription_documents
   where prescription_id = current_setting('vars.rx')::uuid),
  1, 'caso 10b: existe exactamente UN documento congelado');
select is(
  (select prescriber_snapshot ->> 'professional_license' from public.prescriptions
   where id = current_setting('vars.rx')::uuid),
  'CED-1234567',
  'caso 11: el snapshot del prescriptor (con cédula) se generó en servidor');
select pg_temp.logout();
select is(
  (select d.sha256 from public.prescription_documents d
   where d.prescription_id = current_setting('vars.rx')::uuid),
  (select encode(sha256(convert_to(d.content::text, 'UTF8')), 'hex')
   from public.prescription_documents d
   where d.prescription_id = current_setting('vars.rx')::uuid),
  'caso 12: el hash SHA-256 corresponde al contenido canónico congelado');

-- Casos 13-16: inmutabilidad de la receta emitida (dos capas) -----------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
with filas as (
  update public.prescriptions
  set general_instructions = 'intento de edición'
  where id = current_setting('vars.rx')::uuid
  returning id
)
select set_config('vars.upd_emitida', (select count(*)::text from filas), true);
select is(current_setting('vars.upd_emitida'), '0',
  'caso 13: para el cliente, la receta emitida es inalcanzable (0 filas)');
select throws_ok(
  $$insert into public.prescription_items
      (prescription_id, position, medication_name, dosage_text, route_text, frequency_text,
       duration_text)
    values (current_setting('vars.rx')::uuid, 3, 'Extra', '1', 'Oral', 'Única', '1 día')$$,
  '23514', null,
  'caso 14: no se agregan partidas a una receta emitida (trigger antes que RLS)');
select throws_ok(
  $$update public.prescriptions set status = 'voided'
    where id = current_setting('vars.rx')::uuid$$,
  '42501', null,
  'caso 15: el cliente no puede tocar la columna de estado (sin grant)');
select pg_temp.logout();
select throws_ok(
  $$update public.prescriptions set general_instructions = 'x'
    where id = current_setting('vars.rx')::uuid$$,
  '23514', null,
  'caso 16: segunda capa — el trigger RECETA_INMUTABLE bloquea incluso sin RLS');

-- Casos 17-19: visibilidad de emitidas y aislamiento --------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select is(
  (select count(*)::int from public.prescriptions
   where id = current_setting('vars.rx')::uuid),
  1, 'caso 17: recepción sí consulta la receta EMITIDA (documento entregable)');
select lives_ok(
  $$select public.log_prescription_access(current_setting('vars.rx')::uuid, 'print')$$,
  'caso 17b: la impresión autorizada queda en bitácora');
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from public.prescriptions
   where pet_id = current_setting('vars.pet')::uuid),
  0, 'caso 18: la organización B no ve recetas de A (mascota compartida)');
select throws_ok(
  $$insert into public.prescriptions
      (organization_id, clinic_id, clinic_pet_relationship_id, pet_id, encounter_id,
       responsible_owner_id, prescriber_clinic_member_id)
    select organization_id, clinic_id, clinic_pet_relationship_id, pet_id, encounter_id,
           responsible_owner_id, prescriber_clinic_member_id
    from public.prescriptions limit 1$$,
  '42501', null,
  'caso 19: no hay inserts directos de recetas (solo RPCs)');

-- Casos 20-23: sustitución ----------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_ok(
  $$select public.supersede_prescription(current_setting('vars.rx')::uuid, '  ')$$,
  '22023', null,
  'caso 20: la sustitución exige motivo');
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_ok(
  $$select public.supersede_prescription(current_setting('vars.rx')::uuid, 'Dosis corregida')$$,
  '42501', null,
  'caso 21: recepción no sustituye recetas');
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select set_config('vars.rx2', public.supersede_prescription(
  current_setting('vars.rx')::uuid, 'Corrección de frecuencia')::text, true);
select is(
  (select count(*)::int from public.prescription_items
   where prescription_id = current_setting('vars.rx2')::uuid),
  2, 'caso 22: el borrador sustituto copia las partidas del original');
select is(
  (select status::text from public.prescriptions where id = current_setting('vars.rx')::uuid),
  'issued',
  'caso 22b: el original sigue emitido mientras el sustituto es borrador');
select throws_ok(
  $$select public.supersede_prescription(current_setting('vars.rx')::uuid, 'Otra vez')$$,
  '23505', null,
  'caso 23: no puede haber dos sustitutos en curso para el mismo original');

-- Casos 24-25: emisión del sustituto marca superseded (ambos se conservan) ----
select set_config('vars.folio2',
  public.issue_prescription(current_setting('vars.rx2')::uuid), true);
select matches(current_setting('vars.folio2'), '^REC-[0-9]{4}-000002$',
  'caso 24: el sustituto recibe folio nuevo (los folios no se reutilizan)');
select is(
  (select p.status::text || ':' || (p.superseded_by_prescription_id = current_setting('vars.rx2')::uuid)::text
   from public.prescriptions p where p.id = current_setting('vars.rx')::uuid),
  'superseded:true',
  'caso 25: al emitir el sustituto, el original pasa a superseded con referencia');
select is(
  (select count(*)::int from public.prescription_documents
   where prescription_id in (current_setting('vars.rx')::uuid,
                             current_setting('vars.rx2')::uuid)),
  2, 'caso 25b: ambos documentos congelados se conservan');

-- Casos 26-28: anulación ------------------------------------------------------
select throws_ok(
  $$select public.void_prescription(current_setting('vars.rx2')::uuid, 'Error clínico')$$,
  '42501', null,
  'caso 26: el veterinario no anula (permiso elevado requerido)');
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_ok(
  $$select public.void_prescription(current_setting('vars.rx2')::uuid, '')$$,
  '22023', null,
  'caso 26b: la anulación exige motivo');
select is(
  public.void_prescription(current_setting('vars.rx2')::uuid, 'Emitida por error')::text,
  'voided', 'caso 27: administración de la organización anula con motivo');
select is(
  (select count(*)::int from public.prescription_items
   where prescription_id = current_setting('vars.rx2')::uuid),
  2, 'caso 28: la receta anulada conserva su contenido íntegro');

-- Casos 29-31: historial, folios y auditoría redactada ------------------------
select throws_ok(
  $$update public.prescription_status_history set reason = 'x'$$,
  '42501', null,
  'caso 29: el historial de estados es append-only para clientes');
select throws_ok(
  $$select * from public.prescription_folio_counters$$,
  '42501', null,
  'caso 30: los contadores de folio son inaccesibles para clientes');
select pg_temp.logout();
select is(
  (select count(*)::int from public.audit_log
   where new_data::text like '%Amoxicilina%'),
  0, 'caso 31: audit_log NUNCA duplica contenido clínico de la receta');
select cmp_ok(
  (select count(*)::int from public.audit_log
   where entity_type = 'prescriptions'
     and entity_id = current_setting('vars.rx')::uuid),
  '>=', 2,
  'caso 31b: la receta sí deja rastro redactado en audit_log');

-- Casos 32-33: descartar borradores y borrado lógico --------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select set_config('vars.rx3', public.create_prescription_draft(
  current_setting('vars.enc')::uuid)::text, true);
select lives_ok(
  $$select public.discard_prescription_draft(current_setting('vars.rx3')::uuid)$$,
  'caso 32: el prescriptor descarta su borrador (borrado lógico)');
select throws_ok(
  $$select public.issue_prescription(current_setting('vars.rx3')::uuid)$$,
  'P0002', null,
  'caso 33: un borrador descartado ya no puede emitirse');

-- Casos 34-36: catálogo de vacunas --------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select lives_ok(
  $$insert into public.vaccines_catalog
      (organization_id, name, manufacturer, target_species, diseases_covered,
       default_booster_interval_days, created_by)
    values (current_setting('vars.org_a')::uuid, 'Séxtuple canina', 'LabVet',
            array['dog']::public.pet_species[], array['Moquillo', 'Parvovirus'],
            365, '00000000-0000-4000-8000-00000000a001')$$,
  'caso 34: la administración registra productos en el catálogo');
select set_config('vars.vac_cat',
  (select id::text from public.vaccines_catalog
   where organization_id = current_setting('vars.org_a')::uuid limit 1), true);
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_ok(
  $$insert into public.vaccines_catalog (organization_id, name)
    values (current_setting('vars.org_a')::uuid, 'No autorizada')$$,
  '42501', null,
  'caso 35: recepción no administra el catálogo');
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select is(
  (select count(*)::int from public.vaccines_catalog
   where organization_id = current_setting('vars.org_a')::uuid),
  0, 'caso 36: el catálogo de A es invisible para la organización B');

-- Casos 37-41: registrar vacuna aplicada en clínica ---------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_ok(
  $$select public.record_vaccination(
      p_clinic_id => current_setting('vars.clinic_a1')::uuid,
      p_pet_id => current_setting('vars.pet')::uuid,
      p_vaccine_catalog_id => current_setting('vars.vac_cat')::uuid,
      p_lot_number => 'L-001', p_expiration_date => current_date + 365)$$,
  '42501', null,
  'caso 37: recepción no registra aplicaciones en clínica');
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_ok(
  $$select public.record_vaccination(
      p_clinic_id => current_setting('vars.clinic_a1')::uuid,
      p_pet_id => current_setting('vars.pet')::uuid,
      p_vaccine_catalog_id => current_setting('vars.vac_cat')::uuid)$$,
  '23514', null,
  'caso 38: sin lote ni justificación no hay registro (LOTE_REQUERIDO)');
select throws_ok(
  $$select public.record_vaccination(
      p_clinic_id => current_setting('vars.clinic_a1')::uuid,
      p_pet_id => current_setting('vars.pet')::uuid,
      p_vaccine_catalog_id => current_setting('vars.vac_cat')::uuid,
      p_lot_number => 'L-001')$$,
  '23514', null,
  'caso 39: el lote exige caducidad (CADUCIDAD_REQUERIDA)');
select throws_ok(
  $$select public.record_vaccination(
      p_clinic_id => current_setting('vars.clinic_a1')::uuid,
      p_pet_id => current_setting('vars.pet')::uuid,
      p_vaccine_catalog_id => current_setting('vars.vac_cat')::uuid,
      p_lot_number => 'L-001', p_expiration_date => current_date - 1)$$,
  '23514', null,
  'caso 40: un producto caducado no se aplica (PRODUCTO_CADUCADO)');
select set_config('vars.vac1', public.record_vaccination(
  p_clinic_id => current_setting('vars.clinic_a1')::uuid,
  p_pet_id => current_setting('vars.pet')::uuid,
  p_vaccine_catalog_id => current_setting('vars.vac_cat')::uuid,
  p_lot_number => 'L-2026-77', p_expiration_date => current_date + 365,
  p_route_text => 'Subcutánea', p_dose_text => '1 mL',
  p_next_due_at => current_date + 365,
  p_request_id => '11111111-1111-4111-8111-111111111111')::text, true);
select is(
  (select r.source::text || ':' || r.vaccine_name_snapshot
   from public.vaccination_records r where r.id = current_setting('vars.vac1')::uuid),
  'administered_in_clinic:Séxtuple canina',
  'caso 41: la aplicación queda registrada con snapshot del producto');

-- Casos 42-44: idempotencia, comprobante y recordatorio -----------------------
select is(
  public.record_vaccination(
    p_clinic_id => current_setting('vars.clinic_a1')::uuid,
    p_pet_id => current_setting('vars.pet')::uuid,
    p_vaccine_catalog_id => current_setting('vars.vac_cat')::uuid,
    p_lot_number => 'L-2026-77', p_expiration_date => current_date + 365,
    p_request_id => '11111111-1111-4111-8111-111111111111')::text,
  current_setting('vars.vac1'),
  'caso 42: el doble clic (misma idempotency key) devuelve el MISMO registro');
select is(
  (select count(*)::int from public.vaccination_records
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and source = 'administered_in_clinic'),
  1, 'caso 42b: no se creó un segundo registro');
select is(
  (select count(*)::int from public.vaccination_documents
   where vaccination_record_id = current_setting('vars.vac1')::uuid),
  1, 'caso 43: existe un comprobante individual congelado');
select is(
  (select count(*)::int from public.vaccination_notifications
   where vaccination_record_id = current_setting('vars.vac1')::uuid
     and type = 'next_dose_due' and status = 'pending'),
  1, 'caso 44: la próxima dosis confirmada encola UN recordatorio (outbox)');

-- Casos 45-47: inmutabilidad del registro aplicado ----------------------------
select throws_ok(
  $$update public.vaccination_records set lot_number = 'L-XXX'
    where id = current_setting('vars.vac1')::uuid$$,
  '42501', null,
  'caso 45: el cliente no puede modificar un registro aplicado (sin grant)');
select throws_ok(
  $$select public.record_vaccination(
      p_clinic_id => current_setting('vars.clinic_a1')::uuid,
      p_pet_id => current_setting('vars.pet')::uuid,
      p_vaccine_catalog_id => current_setting('vars.vac_cat')::uuid,
      p_lot_number => 'L-2', p_expiration_date => current_date + 100,
      p_next_due_at => current_date - 1)$$,
  '23514', null,
  'caso 46: la próxima dosis debe ser futura (FECHA_INVALIDA)');
select pg_temp.logout();
select throws_ok(
  $$update public.vaccination_records set notes = 'x'
    where id = current_setting('vars.vac1')::uuid$$,
  '23514', null,
  'caso 47: segunda capa — trigger VACUNACION_INMUTABLE incluso sin RLS');

-- Casos 48-52: registros históricos -------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a006');
select throws_ok(
  $$select public.record_historical_vaccination(
      current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
      'historical_owner_document', 'Rabia', current_date - 200)$$,
  '42501', null,
  'caso 48: el asistente no registra vacunas históricas');
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_ok(
  $$select public.record_historical_vaccination(
      current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
      'historical_owner_document', 'Rabia', current_date + 5)$$,
  '23514', null,
  'caso 49: una vacuna histórica no puede tener fecha futura');
select throws_ok(
  $$select public.record_historical_vaccination(
      current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
      'historical_owner_document', 'Rabia', current_date - 200,
      p_next_due_at => current_date + 165)$$,
  '42501', null,
  'caso 50: recepción no confirma próxima dosis (decisión clínica)');
select set_config('vars.vac_hist', public.record_historical_vaccination(
  current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
  'historical_owner_document', 'Rabia', current_date - 200,
  p_provider_name => 'Clínica externa Sur',
  p_document_reference => 'Cartilla física aportada por la propietaria')::text, true);
select is(
  (select r.source::text || ':' || (r.administered_by_clinic_member_id is null)::text
   from public.vaccination_records r
   where r.id = current_setting('vars.vac_hist')::uuid),
  'historical_owner_document:true',
  'caso 51: el histórico queda marcado como aportado, sin veterinario interno');
select throws_ok(
  $$select public.record_historical_vaccination(
      current_setting('vars.clinic_a1')::uuid, current_setting('vars.pet')::uuid,
      'administered_in_clinic', 'Rabia', current_date - 200)$$,
  '22023', null,
  'caso 52: el flujo histórico rechaza la fuente administered_in_clinic');

-- Casos 53-55: aislamiento y accesos ------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from public.vaccination_records
   where clinic_id = current_setting('vars.clinic_a1')::uuid),
  0, 'caso 53: la organización B no ve los registros de vacunación de A');
select set_config('vars.vac_b', public.record_vaccination(
  p_clinic_id => current_setting('vars.clinic_b1')::uuid,
  p_pet_id => current_setting('vars.pet')::uuid,
  p_vaccine_name => 'Triple felina', p_lot_number => 'B-1',
  p_expiration_date => current_date + 90)::text, true);
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select is(
  (select count(*)::int from public.vaccination_records
   where pet_id = current_setting('vars.pet')::uuid),
  2, 'caso 54: recepción de A consulta la cartilla de SU clínica (no la de B)');
select throws_ok(
  $$insert into public.vaccination_records
      (organization_id, clinic_id, pet_id, clinic_pet_relationship_id, source,
       vaccine_name_snapshot, administered_at)
    select organization_id, clinic_id, pet_id, clinic_pet_relationship_id,
           'administered_in_clinic', 'Directa', now()
    from public.vaccination_records limit 1$$,
  '42501', null,
  'caso 55: no hay inserts directos de vacunación (solo RPCs)');

-- Casos 56-58: anulación de vacunación ----------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_ok(
  $$select public.void_vaccination_record(current_setting('vars.vac1')::uuid, 'Error')$$,
  '42501', null,
  'caso 56: el veterinario no anula registros (permiso elevado)');
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select is(
  public.void_vaccination_record(current_setting('vars.vac1')::uuid, 'Registro duplicado')::text,
  'voided', 'caso 57: administración anula con motivo');
select is(
  (select r.lot_number || ':' || (n.status::text)
   from public.vaccination_records r
   join public.vaccination_notifications n on n.vaccination_record_id = r.id
   where r.id = current_setting('vars.vac1')::uuid),
  'L-2026-77:cancelled',
  'caso 58: la anulación conserva el contenido y cancela el recordatorio');

-- Casos 59-62: suspendidos, superadmin, ids manipulados y auditoría -----------
select pg_temp.login('00000000-0000-4000-8000-00000000a008');
select throws_ok(
  $$select public.create_prescription_draft(current_setting('vars.enc')::uuid)$$,
  '42501', null,
  'caso 59: un veterinario suspendido no crea recetas');
select throws_ok(
  $$select public.record_vaccination(
      p_clinic_id => current_setting('vars.clinic_a1')::uuid,
      p_pet_id => current_setting('vars.pet')::uuid,
      p_vaccine_name => 'X', p_lot_number => 'L', p_expiration_date => current_date + 10)$$,
  '42501', null,
  'caso 59b: un veterinario suspendido no registra vacunas');
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_ok(
  $$select public.create_prescription_draft('99999999-9999-4999-8999-999999999999')$$,
  'P0002', null,
  'caso 60: un id de consulta manipulado se rechaza');
select throws_ok(
  $$select public.record_vaccination(
      p_clinic_id => current_setting('vars.clinic_a1')::uuid,
      p_pet_id => '99999999-9999-4999-8999-999999999999',
      p_vaccine_name => 'X', p_lot_number => 'L', p_expiration_date => current_date + 10)$$,
  '23514', null,
  'caso 60b: una mascota sin relación con la clínica se rechaza');
select pg_temp.login('00000000-0000-4000-8000-00000000f001');
select cmp_ok(
  (select count(*)::int from public.prescriptions),
  '>=', 2, 'caso 61: el superadministrador tiene acceso explícito (auditable)');
select pg_temp.logout();
select is(
  (select count(*)::int from public.audit_log
   where new_data::text like '%L-2026-77%'),
  0, 'caso 62: audit_log no expone lotes ni contenido de vacunación');
select cmp_ok(
  (select count(*)::int from public.audit_log
   where entity_type = 'vaccination_records'),
  '>=', 3, 'caso 62b: la vacunación sí deja rastro redactado');

select * from finish();
rollback;
