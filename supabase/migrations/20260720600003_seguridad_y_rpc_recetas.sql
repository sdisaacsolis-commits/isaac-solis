-- ============================================================================
-- Fase 7 — Recetas: helpers de acceso, RLS, auditoría y RPCs
-- ============================================================================
-- Autoridad de permisos: PostgreSQL. La organización SIEMPRE se deriva de la
-- clínica; jamás se confía en ids de organización enviados por el cliente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER, search_path vacío, sin SQL dinámico)
-- ----------------------------------------------------------------------------
create or replace function public.prescription_clinic(p_prescription_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.clinic_id from public.prescriptions p where p.id = p_prescription_id;
$$;

-- Visibilidad: los roles clínicos (administración, veterinarios, asistentes)
-- ven todo; recepción y la administración de la organización ven las recetas
-- YA EMITIDAS (documentos entregables), nunca borradores en preparación.
create or replace function public.can_view_prescription(p_prescription_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.prescriptions p
    where p.id = p_prescription_id
      and (
        exists (
          select 1 from public.clinic_members m
          where m.clinic_id = p.clinic_id
            and m.user_id = (select auth.uid())
            and m.status = 'active' and m.deleted_at is null
            and (m.role in ('clinic_admin', 'veterinarian', 'assistant')
                 or p.status <> 'draft')
        )
        or (p.status <> 'draft' and public.is_organization_admin(p.organization_id))
      )
  );
$$;

-- Edición: SOLO el veterinario prescriptor, con la receta en borrador vigente.
create or replace function public.can_edit_prescription(p_prescription_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.prescriptions p
    join public.clinic_members m on m.id = p.prescriber_clinic_member_id
    where p.id = p_prescription_id
      and p.status = 'draft' and p.deleted_at is null
      and m.user_id = (select auth.uid())
      and m.role = 'veterinarian'
      and m.status = 'active' and m.deleted_at is null
  );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'prescription_clinic(uuid)', 'can_view_prescription(uuid)', 'can_edit_prescription(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Privilegios mínimos (defensa en profundidad junto con RLS)
-- ----------------------------------------------------------------------------
revoke all on table public.prescriptions from public, anon, authenticated;
grant select on table public.prescriptions to authenticated;
-- Solo el contenido editable del borrador; estado, folio y snapshots son
-- inalcanzables para clientes (exclusivos de las RPCs).
grant update (general_instructions, clinical_indication, valid_until)
  on table public.prescriptions to authenticated;
grant all on table public.prescriptions to service_role;

revoke all on table public.prescription_items from public, anon, authenticated;
grant select on table public.prescription_items to authenticated;
grant insert (prescription_id, position, medication_name, active_ingredient, presentation,
              concentration, dosage_text, route_text, frequency_text, duration_text,
              quantity_text, instructions, start_date, end_date, as_needed, notes)
  on table public.prescription_items to authenticated;
grant update (position, medication_name, active_ingredient, presentation, concentration,
              dosage_text, route_text, frequency_text, duration_text, quantity_text,
              instructions, start_date, end_date, as_needed, notes)
  on table public.prescription_items to authenticated;
grant delete on table public.prescription_items to authenticated;
grant all on table public.prescription_items to service_role;

revoke all on table public.prescription_status_history from public, anon, authenticated;
grant select on table public.prescription_status_history to authenticated;
grant select, insert on table public.prescription_status_history to service_role;
revoke update, delete, truncate on table public.prescription_status_history from service_role;

revoke all on table public.prescription_documents from public, anon, authenticated;
grant select on table public.prescription_documents to authenticated;
grant select, insert on table public.prescription_documents to service_role;
revoke update, delete, truncate on table public.prescription_documents from service_role;

revoke all on table public.prescription_folio_counters from public, anon, authenticated;
grant all on table public.prescription_folio_counters to service_role;

-- ----------------------------------------------------------------------------
-- Políticas explícitas por operación
-- ----------------------------------------------------------------------------
create policy prescriptions_select_visibles on public.prescriptions
  for select to authenticated using (public.can_view_prescription(id));
create policy prescriptions_select_superadmin on public.prescriptions
  for select to authenticated using (public.current_user_is_superadmin());
create policy prescriptions_update_borrador on public.prescriptions
  for update to authenticated
  using (public.can_edit_prescription(id))
  with check (public.can_edit_prescription(id));

create policy prescription_items_select_visibles on public.prescription_items
  for select to authenticated using (public.can_view_prescription(prescription_id));
create policy prescription_items_select_superadmin on public.prescription_items
  for select to authenticated using (public.current_user_is_superadmin());
create policy prescription_items_insert_borrador on public.prescription_items
  for insert to authenticated with check (public.can_edit_prescription(prescription_id));
create policy prescription_items_update_borrador on public.prescription_items
  for update to authenticated
  using (public.can_edit_prescription(prescription_id))
  with check (public.can_edit_prescription(prescription_id));
create policy prescription_items_delete_borrador on public.prescription_items
  for delete to authenticated using (public.can_edit_prescription(prescription_id));

create policy prescription_status_history_select on public.prescription_status_history
  for select to authenticated using (public.can_view_prescription(prescription_id));
create policy prescription_status_history_select_superadmin on public.prescription_status_history
  for select to authenticated using (public.current_user_is_superadmin());

create policy prescription_documents_select on public.prescription_documents
  for select to authenticated using (public.can_view_prescription(prescription_id));
create policy prescription_documents_select_superadmin on public.prescription_documents
  for select to authenticated using (public.current_user_is_superadmin());

-- ----------------------------------------------------------------------------
-- Auditoría REDACTADA: jamás se duplica contenido clínico (medicamentos,
-- dosis) en audit_log; solo ids, sección, acción y actor.
-- ----------------------------------------------------------------------------
create or replace function public.audit_prescription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prescription uuid;
  v_org uuid;
  v_clinic uuid;
begin
  if tg_table_name = 'prescriptions' then
    v_prescription := coalesce(new.id, old.id);
  else
    v_prescription := coalesce(new.prescription_id, old.prescription_id);
  end if;
  select p.organization_id, p.clinic_id into v_org, v_clinic
  from public.prescriptions p where p.id = v_prescription;

  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (
    v_org, v_clinic, (select auth.uid()), lower(tg_op), tg_table_name,
    coalesce(new.id, old.id),
    jsonb_build_object('prescription_id', v_prescription, 'section', tg_table_name)
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_prescription_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['prescriptions', 'prescription_items', 'prescription_documents'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_prescription_change()', t, t);
  end loop;
end;
$$;

-- Bitácora de accesos sensibles al documento (impresión/descarga).
create or replace function public.log_prescription_access(
  p_prescription_id uuid,
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
  if p_access_type not in ('print', 'download') then
    raise exception 'ACCESO_INVALIDO' using errcode = '22023';
  end if;
  if not public.can_view_prescription(p_prescription_id) then
    raise exception 'PERMISO_DENEGADO: sin acceso a esta receta.' using errcode = '42501';
  end if;
  select p.organization_id, p.clinic_id into v_org, v_clinic
  from public.prescriptions p where p.id = p_prescription_id;
  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (v_org, v_clinic, (select auth.uid()), p_access_type, 'prescriptions',
          p_prescription_id, jsonb_build_object('access', p_access_type));
end;
$$;

-- ----------------------------------------------------------------------------
-- RPCs transaccionales
-- ----------------------------------------------------------------------------

-- Crear borrador desde una consulta. Se permite PREPARAR durante la consulta
-- abierta; la EMISIÓN exige consulta finalizada (issue_prescription).
create or replace function public.create_prescription_draft(p_encounter_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_enc public.clinical_encounters%rowtype;
  v_member uuid;
  v_owner uuid;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;

  select * into v_enc from public.clinical_encounters e where e.id = p_encounter_id;
  if not found or v_enc.deleted_at is not null then
    raise exception 'CONSULTA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_enc.status = 'voided' then
    raise exception 'ESTADO_INVALIDO: una consulta anulada no origina recetas.'
      using errcode = '23514';
  end if;

  select m.id into v_member from public.clinic_members m
  where m.clinic_id = v_enc.clinic_id and m.user_id = v_user
    and m.role = 'veterinarian' and m.status = 'active' and m.deleted_at is null;
  if not found then
    raise exception 'PERMISO_DENEGADO: solo un veterinario activo de la clínica crea recetas.'
      using errcode = '42501';
  end if;

  -- Propietario responsable: el de la cita si existe; si no, el principal.
  if v_enc.appointment_id is not null then
    select a.owner_id into v_owner from public.appointments a where a.id = v_enc.appointment_id;
  end if;
  if v_owner is null then
    select por.owner_id into v_owner
    from public.pet_owner_relationships por
    where por.pet_id = v_enc.pet_id and por.status = 'active' and por.deleted_at is null
    order by por.is_primary desc, por.started_at
    limit 1;
  end if;
  if v_owner is null then
    raise exception 'PROPIETARIO_REQUERIDO: la mascota no tiene propietario activo.'
      using errcode = '23514';
  end if;

  insert into public.prescriptions
    (organization_id, clinic_id, clinic_pet_relationship_id, pet_id, encounter_id,
     responsible_owner_id, prescriber_clinic_member_id, created_by)
  values
    (v_enc.organization_id, v_enc.clinic_id, v_enc.clinic_pet_relationship_id, v_enc.pet_id,
     p_encounter_id, v_owner, v_member, v_user)
  returning id into v_id;

  return v_id;
end;
$$;

-- Emitir: transaccional, con bloqueo de fila, IDEMPOTENTE y a prueba de doble
-- emisión concurrente. Congela folio, snapshots y el documento canónico.
create or replace function public.issue_prescription(p_prescription_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_p public.prescriptions%rowtype;
  v_old public.prescriptions%rowtype;
  v_tz text;
  v_folio text;
  v_clinic_snapshot jsonb;
  v_prescriber_snapshot jsonb;
  v_pet_snapshot jsonb;
  v_owner_snapshot jsonb;
  v_weight numeric;
  v_items jsonb;
  v_content jsonb;
begin
  select * into v_p from public.prescriptions p
  where p.id = p_prescription_id for update;
  if not found or v_p.deleted_at is not null then
    raise exception 'RECETA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_p.status = 'issued' then
    return v_p.folio; -- repetición idéntica: idempotente, sin folio nuevo
  end if;
  if v_p.status <> 'draft' then
    raise exception 'TRANSICION_INVALIDA: la receta no está en borrador.' using errcode = '23514';
  end if;

  -- Emite el veterinario prescriptor, vigente como veterinario activo.
  if not exists (
    select 1 from public.clinic_members m
    where m.id = v_p.prescriber_clinic_member_id and m.user_id = v_user
      and m.role = 'veterinarian' and m.status = 'active' and m.deleted_at is null
  ) then
    raise exception 'PERMISO_DENEGADO: solo el veterinario prescriptor emite la receta.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.clinical_encounters e
    where e.id = v_p.encounter_id and e.status = 'finalized'
  ) then
    raise exception 'CONSULTA_NO_FINALIZADA: la receta se emite con la consulta finalizada.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.prescription_items i where i.prescription_id = p_prescription_id
  ) then
    raise exception 'RECETA_SIN_PARTIDAS: agrega al menos un medicamento o indicación.'
      using errcode = '23514';
  end if;

  -- Sustitución: bloquear y validar el documento original ANTES de emitir.
  if v_p.supersedes_prescription_id is not null then
    select * into v_old from public.prescriptions p
    where p.id = v_p.supersedes_prescription_id for update;
    if v_old.status <> 'issued' or v_old.superseded_by_prescription_id is not null then
      raise exception 'SUSTITUCION_INVALIDA: la receta original ya no admite sustitución.'
        using errcode = '23514';
    end if;
  end if;

  select c.timezone into v_tz from public.clinics c where c.id = v_p.clinic_id;
  v_folio := public.next_prescription_folio(
    v_p.clinic_id, extract(year from (now() at time zone v_tz))::smallint);

  -- Snapshots generados en SERVIDOR (jamás JSON del cliente).
  select jsonb_build_object(
      'name', c.name, 'phone', c.phone, 'email', c.email,
      'address_line_1', c.address_line_1, 'address_line_2', c.address_line_2,
      'neighborhood', c.neighborhood, 'city', c.city, 'state', c.state,
      'postal_code', c.postal_code, 'timezone', c.timezone)
    into v_clinic_snapshot
  from public.clinics c where c.id = v_p.clinic_id;

  select jsonb_build_object(
      'display_name', coalesce(pr.display_name,
        nullif(btrim(concat(pr.first_name, ' ', pr.last_name)), '')),
      'professional_license', m.professional_license,
      'job_title', m.job_title)
    into v_prescriber_snapshot
  from public.clinic_members m
  join public.profiles pr on pr.id = m.user_id
  where m.id = v_p.prescriber_clinic_member_id;

  -- Peso disponible de la consulta (última medición registrada, si existe).
  select v.weight_kg into v_weight
  from public.clinical_vitals v
  where v.encounter_id = v_p.encounter_id and v.weight_kg is not null
  order by v.created_at desc limit 1;

  select jsonb_build_object(
      'name', p.name, 'species', p.species, 'breed', p.breed, 'sex', p.sex,
      'birth_date', p.birth_date, 'color', p.color,
      'microchip_number', p.microchip_number, 'weight_kg', v_weight)
    into v_pet_snapshot
  from public.pets p where p.id = v_p.pet_id;

  select jsonb_build_object(
      'display_name', coalesce(o.display_name,
        nullif(btrim(concat(o.first_name, ' ', o.last_name)), '')),
      'email', o.email, 'phone', o.phone)
    into v_owner_snapshot
  from public.pet_owners o where o.id = v_p.responsible_owner_id;

  perform set_config('app.prescription_admin_op', 'issue', true);
  perform set_config('app.prescription_reason', '', true);
  update public.prescriptions
  set status = 'issued', folio = v_folio, issued_at = now(), issued_by = v_user,
      clinic_snapshot = v_clinic_snapshot, prescriber_snapshot = v_prescriber_snapshot,
      pet_snapshot = v_pet_snapshot, owner_snapshot = v_owner_snapshot
  where id = p_prescription_id;

  -- La original pasa a superseded SOLO al emitirse la sustituta.
  if v_p.supersedes_prescription_id is not null then
    perform set_config('app.prescription_reason', 'sustituida por ' || v_folio, true);
    update public.prescriptions
    set status = 'superseded', superseded_by_prescription_id = p_prescription_id
    where id = v_p.supersedes_prescription_id;
  end if;
  perform set_config('app.prescription_admin_op', '', true);
  perform set_config('app.prescription_reason', '', true);

  -- Documento canónico congelado (determinista: jsonb normaliza el orden de
  -- llaves) + SHA-256 calculado en la base. Se genera UNA sola vez.
  select jsonb_agg(jsonb_build_object(
      'position', i.position, 'medication_name', i.medication_name,
      'active_ingredient', i.active_ingredient, 'presentation', i.presentation,
      'concentration', i.concentration, 'dosage_text', i.dosage_text,
      'route_text', i.route_text, 'frequency_text', i.frequency_text,
      'duration_text', i.duration_text, 'quantity_text', i.quantity_text,
      'instructions', i.instructions, 'start_date', i.start_date, 'end_date', i.end_date,
      'as_needed', i.as_needed, 'notes', i.notes)
    order by i.position, i.created_at)
    into v_items
  from public.prescription_items i where i.prescription_id = p_prescription_id;

  v_content := jsonb_build_object(
    'template_version', 1,
    'folio', v_folio,
    'issued_at', now(),
    'valid_until', v_p.valid_until,
    'clinic', v_clinic_snapshot,
    'prescriber', v_prescriber_snapshot,
    'pet', v_pet_snapshot,
    'owner', v_owner_snapshot,
    'items', v_items,
    'general_instructions', v_p.general_instructions,
    'clinical_indication', v_p.clinical_indication,
    'supersedes_folio', v_old.folio);

  insert into public.prescription_documents
    (prescription_id, content, sha256, template_version, generated_by)
  values (p_prescription_id, v_content,
          encode(sha256(convert_to(v_content::text, 'UTF8')), 'hex'), 1, v_user);

  return v_folio;
end;
$$;

-- Sustituir: crea un NUEVO borrador que copia el contenido controlado y
-- referencia al original; el original queda intacto (superseded al emitir).
create or replace function public.supersede_prescription(
  p_prescription_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_old public.prescriptions%rowtype;
  v_member uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_new uuid;
begin
  if v_reason is null then
    raise exception 'MOTIVO_REQUERIDO: la sustitución requiere motivo.' using errcode = '22023';
  end if;

  select * into v_old from public.prescriptions p
  where p.id = p_prescription_id for update;
  if not found or v_old.deleted_at is not null then
    raise exception 'RECETA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_old.status <> 'issued' or v_old.superseded_by_prescription_id is not null then
    raise exception 'ESTADO_INVALIDO: solo se sustituye una receta emitida y vigente.'
      using errcode = '23514';
  end if;
  if exists (
    select 1 from public.prescriptions s
    where s.supersedes_prescription_id = p_prescription_id
      and s.deleted_at is null and s.status <> 'voided'
  ) then
    raise exception 'SUSTITUTO_EXISTENTE: ya hay una receta sustituta en curso.'
      using errcode = '23505';
  end if;

  select m.id into v_member from public.clinic_members m
  where m.clinic_id = v_old.clinic_id and m.user_id = v_user
    and m.role = 'veterinarian' and m.status = 'active' and m.deleted_at is null;
  if not found then
    raise exception 'PERMISO_DENEGADO: solo un veterinario activo de la clínica sustituye recetas.'
      using errcode = '42501';
  end if;

  perform set_config('app.prescription_reason', v_reason, true);
  insert into public.prescriptions
    (organization_id, clinic_id, clinic_pet_relationship_id, pet_id, encounter_id,
     responsible_owner_id, prescriber_clinic_member_id, supersedes_prescription_id,
     general_instructions, clinical_indication, valid_until, created_by)
  values
    (v_old.organization_id, v_old.clinic_id, v_old.clinic_pet_relationship_id, v_old.pet_id,
     v_old.encounter_id, v_old.responsible_owner_id, v_member, p_prescription_id,
     v_old.general_instructions, v_old.clinical_indication, v_old.valid_until, v_user)
  returning id into v_new;
  perform set_config('app.prescription_reason', '', true);

  insert into public.prescription_items
    (prescription_id, position, medication_name, active_ingredient, presentation,
     concentration, dosage_text, route_text, frequency_text, duration_text, quantity_text,
     instructions, start_date, end_date, as_needed, notes)
  select v_new, i.position, i.medication_name, i.active_ingredient, i.presentation,
         i.concentration, i.dosage_text, i.route_text, i.frequency_text, i.duration_text,
         i.quantity_text, i.instructions, i.start_date, i.end_date, i.as_needed, i.notes
  from public.prescription_items i
  where i.prescription_id = p_prescription_id;

  return v_new;
end;
$$;

-- Anular: permiso elevado (administración de la organización), motivo
-- obligatorio, contenido y documento intactos, folio no reutilizado.
create or replace function public.void_prescription(
  p_prescription_id uuid,
  p_reason text
)
returns public.prescription_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_p public.prescriptions%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_p from public.prescriptions p
  where p.id = p_prescription_id for update;
  if not found or v_p.deleted_at is not null then
    raise exception 'RECETA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_p.status = 'voided' then
    return 'voided'; -- idempotente
  end if;
  if v_p.status = 'draft' then
    raise exception 'ESTADO_INVALIDO: un borrador se descarta, no se anula.'
      using errcode = '23514';
  end if;
  if v_reason is null then
    raise exception 'MOTIVO_REQUERIDO: la anulación requiere motivo.' using errcode = '22023';
  end if;
  if not public.is_organization_admin(v_p.organization_id) then
    raise exception 'PERMISO_DENEGADO: solo administración de la organización anula recetas.'
      using errcode = '42501';
  end if;

  perform set_config('app.prescription_admin_op', 'void', true);
  perform set_config('app.prescription_reason', v_reason, true);
  update public.prescriptions
  set status = 'voided', voided_at = now(), voided_by = v_user, void_reason = v_reason
  where id = p_prescription_id;
  perform set_config('app.prescription_admin_op', '', true);
  perform set_config('app.prescription_reason', '', true);

  return 'voided';
end;
$$;

-- Descartar un borrador (borrado lógico): solo el prescriptor; jamás toca
-- recetas emitidas.
create or replace function public.discard_prescription_draft(p_prescription_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_p public.prescriptions%rowtype;
begin
  select * into v_p from public.prescriptions p
  where p.id = p_prescription_id for update;
  if not found or v_p.deleted_at is not null then
    raise exception 'RECETA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if v_p.status <> 'draft' then
    raise exception 'ESTADO_INVALIDO: solo se descartan borradores.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.clinic_members m
    where m.id = v_p.prescriber_clinic_member_id and m.user_id = v_user
      and m.status = 'active' and m.deleted_at is null
  ) then
    raise exception 'PERMISO_DENEGADO: solo el prescriptor descarta su borrador.'
      using errcode = '42501';
  end if;

  update public.prescriptions set deleted_at = now() where id = p_prescription_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'create_prescription_draft(uuid)',
    'issue_prescription(uuid)',
    'supersede_prescription(uuid, text)',
    'void_prescription(uuid, text)',
    'discard_prescription_draft(uuid)',
    'log_prescription_access(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
