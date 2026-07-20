-- ============================================================================
-- Fase 6 — Expediente clínico: helpers de acceso, RLS, auditoría y RPCs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER + search_path vacío, sin SQL dinámico; la
-- organización SIEMPRE se deriva de la clínica, nunca del cliente).
-- ----------------------------------------------------------------------------
create or replace function public.encounter_clinic(p_encounter_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select e.clinic_id from public.clinical_encounters e where e.id = p_encounter_id;
$$;

-- Cabecera administrativa: cualquier miembro activo de la clínica.
create or replace function public.can_view_clinical_encounter(p_encounter_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_clinic_member(public.encounter_clinic(p_encounter_id));
$$;

-- Contenido clínico sensible: administración, veterinarios y asistentes.
-- Recepción queda EXCLUIDA por diseño (docs/clinical/privacy.md).
create or replace function public.can_view_clinical_content(p_encounter_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1 from public.clinic_members m
      where m.clinic_id = public.encounter_clinic(p_encounter_id)
        and m.user_id = (select auth.uid())
        and m.role in ('clinic_admin', 'veterinarian', 'assistant')
        and m.status = 'active' and m.deleted_at is null
    )
    or public.is_clinic_admin(public.encounter_clinic(p_encounter_id));
$$;

create or replace function public.is_encounter_veterinarian(p_encounter_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.clinical_encounters e
    join public.clinic_members m on m.id = e.responsible_veterinarian_clinic_member_id
    where e.id = p_encounter_id
      and m.user_id = (select auth.uid())
      and m.status = 'active' and m.deleted_at is null
  );
$$;

-- Edición de contenido clínico: consulta ABIERTA + veterinario activo de la
-- clínica (o administración con rol clínico implícito de gestión).
create or replace function public.can_edit_clinical_encounter(p_encounter_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1
      from public.clinical_encounters e
      join public.clinic_members m on m.clinic_id = e.clinic_id
      where e.id = p_encounter_id
        and e.status = 'in_progress'
        and m.user_id = (select auth.uid())
        and m.role = 'veterinarian'
        and m.status = 'active' and m.deleted_at is null
    );
$$;

-- Vitales: además de veterinarios, los asistentes autorizados capturan.
create or replace function public.can_record_vitals(p_encounter_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
      select 1
      from public.clinical_encounters e
      join public.clinic_members m on m.clinic_id = e.clinic_id
      where e.id = p_encounter_id
        and e.status = 'in_progress'
        and m.user_id = (select auth.uid())
        and m.role in ('veterinarian', 'assistant')
        and m.status = 'active' and m.deleted_at is null
    );
$$;

-- Finalizar: veterinario activo de la clínica que sea el responsable, o
-- administración que ADEMÁS tenga rol veterinario (la firma es acto clínico).
create or replace function public.can_finalize_clinical_encounter(p_encounter_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_encounter_veterinarian(p_encounter_id)
    or (
      public.is_clinic_admin(public.encounter_clinic(p_encounter_id))
      and exists (
        select 1 from public.clinic_members m
        where m.clinic_id = public.encounter_clinic(p_encounter_id)
          and m.user_id = (select auth.uid())
          and m.role = 'veterinarian'
          and m.status = 'active' and m.deleted_at is null
      )
    );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'encounter_clinic(uuid)', 'can_view_clinical_encounter(uuid)',
    'can_view_clinical_content(uuid)', 'is_encounter_veterinarian(uuid)',
    'can_edit_clinical_encounter(uuid)', 'can_record_vitals(uuid)',
    'can_finalize_clinical_encounter(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Privilegios mínimos
-- ----------------------------------------------------------------------------
revoke all on table public.clinical_encounters from public, anon, authenticated;
grant select on table public.clinical_encounters to authenticated;
grant update (chief_complaint, vitals_skipped_reason, examination_skipped_reason, internal_notes)
  on table public.clinical_encounters to authenticated;
grant all on table public.clinical_encounters to service_role;

revoke all on table public.encounter_status_history from public, anon, authenticated;
grant select on table public.encounter_status_history to authenticated;
grant select, insert on table public.encounter_status_history to service_role;
revoke update, delete, truncate on table public.encounter_status_history from service_role;

revoke all on table public.clinical_notes from public, anon, authenticated;
grant select on table public.clinical_notes to authenticated;
grant insert (encounter_id, history_summary, subjective, objective, assessment, plan,
              author_clinic_member_id)
  on table public.clinical_notes to authenticated;
grant update (history_summary, subjective, objective, assessment, plan, author_clinic_member_id)
  on table public.clinical_notes to authenticated;
grant all on table public.clinical_notes to service_role;

revoke all on table public.encounter_examinations from public, anon, authenticated;
grant select on table public.encounter_examinations to authenticated;
grant insert (encounter_id, general_condition, attitude, body_condition, skin_and_coat, eyes,
              ears, oral_cavity, cardiovascular, respiratory, digestive, urinary,
              musculoskeletal, neurological, lymph_nodes, additional_findings, observations,
              examined_by)
  on table public.encounter_examinations to authenticated;
grant update (general_condition, attitude, body_condition, skin_and_coat, eyes, ears,
              oral_cavity, cardiovascular, respiratory, digestive, urinary, musculoskeletal,
              neurological, lymph_nodes, additional_findings, observations, examined_by)
  on table public.encounter_examinations to authenticated;
grant all on table public.encounter_examinations to service_role;

revoke all on table public.clinical_vitals from public, anon, authenticated;
grant select on table public.clinical_vitals to authenticated;
grant insert (encounter_id, recorded_by, weight_kg, temperature_c, heart_rate_bpm,
              respiratory_rate_bpm, capillary_refill_seconds, body_condition_score, pain_score,
              hydration_status, mucous_membranes, blood_pressure_systolic,
              blood_pressure_diastolic, notes)
  on table public.clinical_vitals to authenticated;
-- Append-only: sin UPDATE/DELETE para clientes; el backend tampoco reescribe.
grant select, insert on table public.clinical_vitals to service_role;
revoke update, delete, truncate on table public.clinical_vitals from service_role;

revoke all on table public.diagnoses from public, anon, authenticated;
grant select on table public.diagnoses to authenticated;
grant insert (encounter_id, code_system, code, name, description, certainty, is_primary,
              diagnosed_by)
  on table public.diagnoses to authenticated;
grant update (code_system, code, name, description, certainty, is_primary, deleted_at)
  on table public.diagnoses to authenticated;
grant all on table public.diagnoses to service_role;

revoke all on table public.encounter_treatments from public, anon, authenticated;
grant select on table public.encounter_treatments to authenticated;
grant insert (encounter_id, treatment_type, name, description, instructions, dosage_text,
              route_text, frequency_text, duration_text, performed_during_encounter, created_by)
  on table public.encounter_treatments to authenticated;
grant update (treatment_type, name, description, instructions, dosage_text, route_text,
              frequency_text, duration_text, performed_during_encounter, deleted_at)
  on table public.encounter_treatments to authenticated;
grant all on table public.encounter_treatments to service_role;

revoke all on table public.encounter_follow_ups from public, anon, authenticated;
grant select on table public.encounter_follow_ups to authenticated;
grant insert (encounter_id, recommended_within_days, reason, service_id)
  on table public.encounter_follow_ups to authenticated;
grant update (recommended_within_days, reason, service_id, status, appointment_id)
  on table public.encounter_follow_ups to authenticated;
grant all on table public.encounter_follow_ups to service_role;

revoke all on table public.clinical_files from public, anon, authenticated;
grant select on table public.clinical_files to authenticated;
grant insert (organization_id, clinic_id, pet_id, encounter_id, storage_path,
              original_filename, mime_type, size_bytes, kind, description, uploaded_by)
  on table public.clinical_files to authenticated;
grant all on table public.clinical_files to service_role;

revoke all on table public.encounter_addenda from public, anon, authenticated;
grant select on table public.encounter_addenda to authenticated;
grant insert (encounter_id, content, reason, created_by)
  on table public.encounter_addenda to authenticated;
grant select, insert on table public.encounter_addenda to service_role;
revoke update, delete, truncate on table public.encounter_addenda from service_role;

revoke all on table public.clinical_folio_counters from public, anon, authenticated;
grant all on table public.clinical_folio_counters to service_role;

-- ----------------------------------------------------------------------------
-- Políticas explícitas por operación
-- ----------------------------------------------------------------------------
create policy clinical_encounters_select_membresia on public.clinical_encounters
  for select to authenticated using (public.is_clinic_member(clinic_id));
create policy clinical_encounters_select_superadmin on public.clinical_encounters
  for select to authenticated using (public.current_user_is_superadmin());
create policy clinical_encounters_update_edicion on public.clinical_encounters
  for update to authenticated
  using (public.can_edit_clinical_encounter(id))
  with check (public.can_edit_clinical_encounter(id));

create policy encounter_status_history_select on public.encounter_status_history
  for select to authenticated using (public.can_view_clinical_encounter(encounter_id));
create policy encounter_status_history_select_superadmin on public.encounter_status_history
  for select to authenticated using (public.current_user_is_superadmin());

-- Contenido clínico: SELECT restringido; escritura solo con consulta abierta.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clinical_notes', 'encounter_examinations', 'diagnoses',
    'encounter_treatments', 'encounter_follow_ups'
  ] loop
    execute format(
      'create policy %I_select_contenido on public.%I for select to authenticated
         using (public.can_view_clinical_content(encounter_id))', t, t);
    execute format(
      'create policy %I_select_superadmin on public.%I for select to authenticated
         using (public.current_user_is_superadmin())', t, t);
    execute format(
      'create policy %I_insert_edicion on public.%I for insert to authenticated
         with check (public.can_edit_clinical_encounter(encounter_id))', t, t);
    execute format(
      'create policy %I_update_edicion on public.%I for update to authenticated
         using (public.can_edit_clinical_encounter(encounter_id))
         with check (public.can_edit_clinical_encounter(encounter_id))', t, t);
  end loop;
end;
$$;

create policy clinical_vitals_select_contenido on public.clinical_vitals
  for select to authenticated using (public.can_view_clinical_content(encounter_id));
create policy clinical_vitals_select_superadmin on public.clinical_vitals
  for select to authenticated using (public.current_user_is_superadmin());
create policy clinical_vitals_insert_captura on public.clinical_vitals
  for insert to authenticated with check (public.can_record_vitals(encounter_id));

create policy clinical_files_select_contenido on public.clinical_files
  for select to authenticated using (public.can_view_clinical_content(encounter_id));
create policy clinical_files_select_superadmin on public.clinical_files
  for select to authenticated using (public.current_user_is_superadmin());
create policy clinical_files_insert_clinico on public.clinical_files
  for insert to authenticated
  with check (
    public.can_view_clinical_content(encounter_id)
    and exists (
      select 1 from public.clinic_members m
      where m.clinic_id = clinical_files.clinic_id
        and m.user_id = (select auth.uid())
        and m.role in ('clinic_admin', 'veterinarian')
        and m.status = 'active' and m.deleted_at is null
    )
  );

create policy encounter_addenda_select_contenido on public.encounter_addenda
  for select to authenticated using (public.can_view_clinical_content(encounter_id));
create policy encounter_addenda_select_superadmin on public.encounter_addenda
  for select to authenticated using (public.current_user_is_superadmin());
create policy encounter_addenda_insert_vet on public.encounter_addenda
  for insert to authenticated
  with check (
    exists (
      select 1 from public.clinic_members m
      where m.clinic_id = public.encounter_clinic(encounter_id)
        and m.user_id = (select auth.uid())
        and m.role = 'veterinarian'
        and m.status = 'active' and m.deleted_at is null
    )
  );

-- Storage: archivos clínicos ligados al acceso del expediente.
create or replace function public.clinical_encounter_from_storage_path(p_name text)
returns uuid
language sql immutable security definer set search_path = ''
as $$
  select nullif((storage.foldername(p_name))[4], '')::uuid;
$$;

revoke all on function public.clinical_encounter_from_storage_path(text) from public, anon;
grant execute on function public.clinical_encounter_from_storage_path(text)
  to authenticated, service_role;

create policy clinical_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'clinical-files'
    and public.can_view_clinical_content(public.clinical_encounter_from_storage_path(name))
  );
create policy clinical_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'clinical-files'
    and public.can_view_clinical_content(public.clinical_encounter_from_storage_path(name))
    and exists (
      select 1 from public.clinic_members m
      where m.clinic_id = public.encounter_clinic(
              public.clinical_encounter_from_storage_path(name))
        and m.user_id = (select auth.uid())
        and m.role in ('clinic_admin', 'veterinarian')
        and m.status = 'active' and m.deleted_at is null
    )
  );

-- ----------------------------------------------------------------------------
-- Auditoría REDACTADA para tablas clínicas: nunca se duplica el contenido
-- clínico en audit_log; solo ids, sección, acción y actor.
-- ----------------------------------------------------------------------------
create or replace function public.audit_clinical_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encounter uuid;
  v_org uuid;
  v_clinic uuid;
  v_id uuid;
begin
  if tg_table_name = 'clinical_encounters' then
    v_encounter := coalesce(new.id, old.id);
  else
    v_encounter := coalesce(new.encounter_id, old.encounter_id);
  end if;
  v_id := coalesce(new.id, old.id);
  select e.organization_id, e.clinic_id into v_org, v_clinic
  from public.clinical_encounters e where e.id = v_encounter;

  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (
    v_org, v_clinic, (select auth.uid()), lower(tg_op), tg_table_name, v_id,
    jsonb_build_object('encounter_id', v_encounter, 'section', tg_table_name)
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_clinical_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clinical_encounters', 'clinical_notes', 'encounter_examinations', 'clinical_vitals',
    'diagnoses', 'encounter_treatments', 'encounter_follow_ups', 'clinical_files',
    'encounter_addenda'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_clinical_change()', t, t);
  end loop;
end;
$$;

-- Accesos sensibles (impresión, descarga): bitácora vía audit_log, no tabla
-- nueva (decisión en docs/clinical/privacy.md).
create or replace function public.log_clinical_record_access(
  p_encounter_id uuid,
  p_access_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid; v_clinic uuid;
begin
  if p_access_type not in ('print', 'file_download', 'record_view') then
    raise exception 'ACCESO_INVALIDO' using errcode = '22023';
  end if;
  if not public.can_view_clinical_content(p_encounter_id) then
    raise exception 'PERMISO_DENEGADO: sin acceso al contenido clínico.' using errcode = '42501';
  end if;
  select e.organization_id, e.clinic_id into v_org, v_clinic
  from public.clinical_encounters e where e.id = p_encounter_id;
  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (v_org, v_clinic, (select auth.uid()), p_access_type, 'clinical_encounters',
          p_encounter_id, jsonb_build_object('access', p_access_type));
end;
$$;

-- ----------------------------------------------------------------------------
-- RPCs transaccionales
-- ----------------------------------------------------------------------------

-- Abrir consulta desde una cita (IDEMPOTENTE: el índice único parcial
-- resuelve el doble clic y la concurrencia). Estados aceptados: checked_in e
-- in_progress; también confirmed para atención inmediata (decisión
-- documentada): la RPC encadena las transiciones legales de la cita.
create or replace function public.start_encounter_from_appointment(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_appt public.appointments%rowtype;
  v_rel uuid;
  v_encounter uuid;
  v_type public.encounter_type;
  v_tz text;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;

  select * into v_appt from public.appointments a where a.id = p_appointment_id;
  if not found then
    raise exception 'CITA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.is_clinic_operational_staff(v_appt.clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no gestiona consultas en esta clínica.'
      using errcode = '42501';
  end if;

  select id into v_encounter from public.clinical_encounters e
  where e.appointment_id = p_appointment_id and e.status <> 'voided';
  if found then
    return v_encounter; -- idempotente
  end if;

  if v_appt.status not in ('confirmed', 'checked_in', 'in_progress') then
    raise exception 'ESTADO_INVALIDO: la cita no admite iniciar consulta.' using errcode = '23514';
  end if;

  select r.id into v_rel from public.clinic_pet_relationships r
  where r.clinic_id = v_appt.clinic_id and r.pet_id = v_appt.pet_id
    and r.status = 'active' and r.deleted_at is null;
  if not found then
    raise exception 'MASCOTA_SIN_RELACION: la mascota no tiene relación activa con la clínica.'
      using errcode = '23514';
  end if;

  -- Transiciones de agenda (la RPC de agenda audita y aplica los roles:
  -- iniciar la atención sigue siendo acto de veterinario/administración).
  if v_appt.status = 'confirmed' then
    perform public.transition_appointment_status(p_appointment_id, 'checked_in', null);
  end if;
  if v_appt.status in ('confirmed', 'checked_in') then
    perform public.transition_appointment_status(p_appointment_id, 'in_progress', null);
  end if;

  v_type := case
    when v_appt.emergency then 'emergency'::public.encounter_type
    when v_appt.source = 'walk_in' then 'walk_in'::public.encounter_type
    else 'scheduled'::public.encounter_type
  end;
  select c.timezone into v_tz from public.clinics c where c.id = v_appt.clinic_id;

  begin
    insert into public.clinical_encounters
      (organization_id, clinic_id, clinic_pet_relationship_id, pet_id, appointment_id,
       responsible_veterinarian_clinic_member_id, encounter_type, folio, chief_complaint,
       created_by)
    values
      (v_appt.organization_id, v_appt.clinic_id, v_rel, v_appt.pet_id, p_appointment_id,
       v_appt.veterinarian_clinic_member_id, v_type,
       public.next_clinical_folio(v_appt.clinic_id,
         extract(year from (now() at time zone v_tz))::smallint),
       v_appt.reason, v_user)
    returning id into v_encounter;
  exception
    when unique_violation then
      select id into v_encounter from public.clinical_encounters e
      where e.appointment_id = p_appointment_id and e.status <> 'voided';
  end;

  return v_encounter;
end;
$$;

-- Walk-in / urgencia: crea la cita interna (fuente de verdad de agenda y
-- métricas), la recibe y abre la consulta — todo en una transacción.
create or replace function public.create_walk_in_encounter(
  p_clinic_id uuid,
  p_pet_id uuid,
  p_owner_id uuid,
  p_veterinarian_clinic_member_id uuid,
  p_service_ids uuid[],
  p_encounter_type public.encounter_type default 'walk_in',
  p_chief_complaint text default null,
  p_emergency_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment uuid;
  v_encounter uuid;
begin
  if p_encounter_type not in ('walk_in', 'emergency') then
    raise exception 'TIPO_INVALIDO: solo walk_in o emergency.' using errcode = '22023';
  end if;

  v_appointment := public.book_appointment(
    p_clinic_id, p_pet_id, p_owner_id, p_veterinarian_clinic_member_id, p_service_ids,
    now(), 'walk_in', p_chief_complaint,
    p_encounter_type = 'emergency',
    case when p_encounter_type = 'emergency'
         then coalesce(p_emergency_reason, p_chief_complaint, 'Urgencia') end,
    null);

  v_encounter := public.start_encounter_from_appointment(v_appointment);

  update public.clinical_encounters
  set encounter_type = p_encounter_type,
      chief_complaint = coalesce(p_chief_complaint, chief_complaint)
  where id = v_encounter and status = 'in_progress';

  return v_encounter;
end;
$$;

-- Finalizar: transaccional, idempotente y seguro ante concurrencia.
create or replace function public.finalize_clinical_encounter(p_encounter_id uuid)
returns public.encounter_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_enc public.clinical_encounters%rowtype;
  v_note public.clinical_notes%rowtype;
  v_appt_status public.appointment_status;
begin
  select * into v_enc from public.clinical_encounters e
  where e.id = p_encounter_id for update;
  if not found then
    raise exception 'CONSULTA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_enc.status = 'finalized' then
    return 'finalized'; -- repetición idéntica: idempotente
  end if;
  if v_enc.status <> 'in_progress' then
    raise exception 'TRANSICION_INVALIDA: la consulta no está abierta.' using errcode = '23514';
  end if;
  if not public.can_finalize_clinical_encounter(p_encounter_id) then
    raise exception 'PERMISO_DENEGADO: solo el veterinario responsable finaliza la consulta.'
      using errcode = '42501';
  end if;

  -- Requisitos mínimos (docs/clinical/finalization-and-addenda.md): motivo,
  -- evaluación y plan; exploración y vitales pueden omitirse con motivo.
  if nullif(btrim(coalesce(v_enc.chief_complaint, '')), '') is null then
    raise exception 'FALTA_MOTIVO: registra el motivo de consulta.' using errcode = '23514';
  end if;
  select * into v_note from public.clinical_notes n where n.encounter_id = p_encounter_id;
  if not found or nullif(btrim(coalesce(v_note.assessment, '')), '') is null
     or nullif(btrim(coalesce(v_note.plan, '')), '') is null then
    raise exception 'NOTA_INCOMPLETA: la nota requiere evaluación y plan.' using errcode = '23514';
  end if;
  if not exists (
       select 1 from public.encounter_examinations x where x.encounter_id = p_encounter_id)
     and nullif(btrim(coalesce(v_enc.examination_skipped_reason, '')), '') is null then
    raise exception 'FALTA_EXPLORACION: captura la exploración o justifica su omisión.'
      using errcode = '23514';
  end if;
  if not exists (select 1 from public.clinical_vitals v where v.encounter_id = p_encounter_id)
     and nullif(btrim(coalesce(v_enc.vitals_skipped_reason, '')), '') is null then
    raise exception 'FALTAN_VITALES: captura signos vitales o justifica su omisión.'
      using errcode = '23514';
  end if;

  perform set_config('app.encounter_admin_op', 'finalize', true);
  perform set_config('app.encounter_reason', '', true);
  update public.clinical_encounters
  set status = 'finalized', finalized_at = now(), finalized_by = v_user
  where id = p_encounter_id;
  perform set_config('app.encounter_admin_op', '', true);

  -- Completar la cita vinculada (la transición de agenda actualiza
  -- first/last_visit_at UNA sola vez porque solo puede ocurrir una vez).
  if v_enc.appointment_id is not null then
    select a.status into v_appt_status from public.appointments a
    where a.id = v_enc.appointment_id;
    if v_appt_status = 'in_progress' then
      perform public.transition_appointment_status(v_enc.appointment_id, 'completed', null);
    end if;
  end if;

  return 'finalized';
end;
$$;

-- Anulación administrativa: permiso elevado (administración de la
-- organización), motivo obligatorio, contenido intacto, folio no reutilizado.
create or replace function public.void_clinical_encounter(
  p_encounter_id uuid,
  p_reason text
)
returns public.encounter_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_enc public.clinical_encounters%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_enc from public.clinical_encounters e
  where e.id = p_encounter_id for update;
  if not found then
    raise exception 'CONSULTA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_enc.status = 'voided' then
    return 'voided';
  end if;
  if v_reason is null then
    raise exception 'MOTIVO_REQUERIDO: la anulación requiere motivo.' using errcode = '22023';
  end if;
  if not public.is_organization_admin(v_enc.organization_id) then
    raise exception 'PERMISO_DENEGADO: solo administración de la organización anula consultas.'
      using errcode = '42501';
  end if;

  perform set_config('app.encounter_admin_op', 'void', true);
  perform set_config('app.encounter_reason', v_reason, true);
  update public.clinical_encounters
  set status = 'voided', voided_at = now(), voided_by = v_user, void_reason = v_reason
  where id = p_encounter_id;
  perform set_config('app.encounter_admin_op', '', true);

  return 'voided';
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'start_encounter_from_appointment(uuid)',
    'create_walk_in_encounter(uuid, uuid, uuid, uuid, uuid[], public.encounter_type, text, text)',
    'finalize_clinical_encounter(uuid)',
    'void_clinical_encounter(uuid, text)',
    'log_clinical_record_access(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
