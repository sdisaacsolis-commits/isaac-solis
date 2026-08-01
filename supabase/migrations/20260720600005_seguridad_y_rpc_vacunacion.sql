-- ============================================================================
-- Fase 7 — Vacunación: helpers de acceso, RLS, auditoría, RPCs y recordatorios
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function public.vaccination_record_clinic(p_record_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select r.clinic_id from public.vaccination_records r where r.id = p_record_id;
$$;

-- La cartilla es operativa para todo el personal activo de la clínica
-- (incluida recepción) y para la administración de la organización.
create or replace function public.can_view_vaccination_record(p_record_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.vaccination_records r
    where r.id = p_record_id
      and (public.is_clinic_member(r.clinic_id)
           or public.is_organization_admin(r.organization_id))
  );
$$;

-- Catálogo: lo administran clinic_admins de la organización y administración
-- de la organización.
create or replace function public.can_manage_vaccine_catalog(p_organization_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_organization_admin(p_organization_id)
    or exists (
      select 1
      from public.clinic_members m
      join public.clinics c on c.id = m.clinic_id
      where c.organization_id = p_organization_id
        and m.user_id = (select auth.uid())
        and m.role = 'clinic_admin'
        and m.status = 'active' and m.deleted_at is null
    );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'vaccination_record_clinic(uuid)', 'can_view_vaccination_record(uuid)',
    'can_manage_vaccine_catalog(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Privilegios mínimos
-- ----------------------------------------------------------------------------
revoke all on table public.vaccines_catalog from public, anon, authenticated;
grant select on table public.vaccines_catalog to authenticated;
grant insert (organization_id, name, manufacturer, target_species, diseases_covered,
              presentation, default_booster_interval_days, active, created_by)
  on table public.vaccines_catalog to authenticated;
grant update (name, manufacturer, target_species, diseases_covered, presentation,
              default_booster_interval_days, active, deleted_at)
  on table public.vaccines_catalog to authenticated;
grant all on table public.vaccines_catalog to service_role;

-- Registros: SOLO lectura para clientes; toda escritura pasa por RPCs.
revoke all on table public.vaccination_records from public, anon, authenticated;
grant select on table public.vaccination_records to authenticated;
grant all on table public.vaccination_records to service_role;

revoke all on table public.vaccination_status_history from public, anon, authenticated;
grant select on table public.vaccination_status_history to authenticated;
grant select, insert on table public.vaccination_status_history to service_role;
revoke update, delete, truncate on table public.vaccination_status_history from service_role;

revoke all on table public.vaccination_documents from public, anon, authenticated;
grant select on table public.vaccination_documents to authenticated;
grant select, insert on table public.vaccination_documents to service_role;
revoke update, delete, truncate on table public.vaccination_documents from service_role;

revoke all on table public.vaccination_notifications from public, anon, authenticated;
grant select on table public.vaccination_notifications to authenticated;
grant all on table public.vaccination_notifications to service_role;

-- ----------------------------------------------------------------------------
-- Políticas explícitas por operación
-- ----------------------------------------------------------------------------
create policy vaccines_catalog_select_organizacion on public.vaccines_catalog
  for select to authenticated using (public.is_organization_member(organization_id));
create policy vaccines_catalog_select_superadmin on public.vaccines_catalog
  for select to authenticated using (public.current_user_is_superadmin());
create policy vaccines_catalog_insert_gestion on public.vaccines_catalog
  for insert to authenticated with check (public.can_manage_vaccine_catalog(organization_id));
create policy vaccines_catalog_update_gestion on public.vaccines_catalog
  for update to authenticated
  using (public.can_manage_vaccine_catalog(organization_id))
  with check (public.can_manage_vaccine_catalog(organization_id));

create policy vaccination_records_select_membresia on public.vaccination_records
  for select to authenticated using (public.can_view_vaccination_record(id));
create policy vaccination_records_select_superadmin on public.vaccination_records
  for select to authenticated using (public.current_user_is_superadmin());

create policy vaccination_status_history_select on public.vaccination_status_history
  for select to authenticated
  using (public.can_view_vaccination_record(vaccination_record_id));
create policy vaccination_status_history_select_superadmin on public.vaccination_status_history
  for select to authenticated using (public.current_user_is_superadmin());

create policy vaccination_documents_select on public.vaccination_documents
  for select to authenticated
  using (public.can_view_vaccination_record(vaccination_record_id));
create policy vaccination_documents_select_superadmin on public.vaccination_documents
  for select to authenticated using (public.current_user_is_superadmin());

create policy vaccination_notifications_select_operativos on public.vaccination_notifications
  for select to authenticated
  using (public.is_clinic_operational_staff(clinic_id));
create policy vaccination_notifications_select_superadmin on public.vaccination_notifications
  for select to authenticated using (public.current_user_is_superadmin());

-- Storage: comprobantes históricos ligados al acceso del expediente de la
-- mascota en la clínica. Suben quienes registran históricos (administración,
-- veterinarios, recepción) de una clínica con relación activa a la mascota.
create or replace function public.vaccination_pet_from_storage_path(p_name text)
returns uuid
language sql immutable security definer set search_path = ''
as $$
  select case
    when p_name ~ '^pets/[0-9a-f-]{36}/vaccinations/'
      then nullif((storage.foldername(p_name))[2], '')::uuid
  end;
$$;

revoke all on function public.vaccination_pet_from_storage_path(text) from public, anon;
grant execute on function public.vaccination_pet_from_storage_path(text)
  to authenticated, service_role;

create policy vaccination_files_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vaccination-files'
    and exists (
      select 1
      from public.clinic_pet_relationships r
      join public.clinic_members m on m.clinic_id = r.clinic_id
      where r.pet_id = public.vaccination_pet_from_storage_path(name)
        and r.status = 'active' and r.deleted_at is null
        and m.user_id = (select auth.uid())
        and m.status = 'active' and m.deleted_at is null
    )
  );
create policy vaccination_files_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vaccination-files'
    and exists (
      select 1
      from public.clinic_pet_relationships r
      join public.clinic_members m on m.clinic_id = r.clinic_id
      where r.pet_id = public.vaccination_pet_from_storage_path(name)
        and r.status = 'active' and r.deleted_at is null
        and m.user_id = (select auth.uid())
        and m.role in ('clinic_admin', 'veterinarian', 'receptionist')
        and m.status = 'active' and m.deleted_at is null
    )
  );

-- ----------------------------------------------------------------------------
-- Auditoría REDACTADA (sin producto, lote ni datos clínicos en audit_log).
-- ----------------------------------------------------------------------------
create or replace function public.audit_vaccination_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record uuid;
  v_org uuid;
  v_clinic uuid;
begin
  if tg_table_name = 'vaccination_records' then
    v_record := coalesce(new.id, old.id);
  else
    v_record := coalesce(new.vaccination_record_id, old.vaccination_record_id);
  end if;
  select r.organization_id, r.clinic_id into v_org, v_clinic
  from public.vaccination_records r where r.id = v_record;

  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (
    v_org, v_clinic, (select auth.uid()), lower(tg_op), tg_table_name,
    coalesce(new.id, old.id),
    jsonb_build_object('vaccination_record_id', v_record, 'section', tg_table_name)
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_vaccination_change() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['vaccination_records', 'vaccination_documents'] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_vaccination_change()', t, t);
  end loop;
end;
$$;

-- El catálogo no referencia registros: su auditoría usa el resolvedor
-- genérico existente (contenido no clínico).
create trigger vaccines_catalog_audit
  after insert or update or delete on public.vaccines_catalog
  for each row execute function public.audit_row_change();

-- Bitácora de accesos sensibles (impresión de comprobante o cartilla).
create or replace function public.log_vaccination_access(
  p_record_id uuid,
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
  if p_access_type not in ('print', 'download', 'card_print') then
    raise exception 'ACCESO_INVALIDO' using errcode = '22023';
  end if;
  if not public.can_view_vaccination_record(p_record_id) then
    raise exception 'PERMISO_DENEGADO: sin acceso a este registro.' using errcode = '42501';
  end if;
  select r.organization_id, r.clinic_id into v_org, v_clinic
  from public.vaccination_records r where r.id = p_record_id;
  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, new_data)
  values (v_org, v_clinic, (select auth.uid()), p_access_type, 'vaccination_records',
          p_record_id, jsonb_build_object('access', p_access_type));
end;
$$;

-- ----------------------------------------------------------------------------
-- Recordatorios (outbox): intención en la MISMA transacción del registro.
-- ----------------------------------------------------------------------------
create or replace function public.enqueue_vaccination_reminder(p_record_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec public.vaccination_records%rowtype;
  v_owner public.pet_owners%rowtype;
  v_clinic_name text;
  v_tz text;
  v_pet_name text;
  v_due_ts timestamptz;
  v_scheduled timestamptz;
begin
  select * into v_rec from public.vaccination_records r where r.id = p_record_id;
  if not found or v_rec.next_due_at is null or v_rec.status <> 'recorded' then
    return;
  end if;

  select c.name, c.timezone into v_clinic_name, v_tz
  from public.clinics c where c.id = v_rec.clinic_id;
  select p.name into v_pet_name from public.pets p where p.id = v_rec.pet_id;

  -- Destinatario: propietario principal activo con correo (sin correo no hay
  -- canal en esta fase; el panel siempre muestra las próximas dosis).
  select o.* into v_owner
  from public.pet_owner_relationships por
  join public.pet_owners o on o.id = por.owner_id
  where por.pet_id = v_rec.pet_id and por.status = 'active' and por.deleted_at is null
    and o.email is not null and o.deleted_at is null
  order by por.is_primary desc, por.started_at
  limit 1;
  if not found then
    return;
  end if;

  -- 09:00 hora local de la clínica del día objetivo; aviso 7 días antes (o
  -- inmediato si ya estamos dentro de la ventana y la fecha sigue vigente).
  v_due_ts := (v_rec.next_due_at::text || ' 09:00')::timestamp at time zone v_tz;
  v_scheduled := v_due_ts - interval '7 days';
  if v_scheduled <= now() then
    v_scheduled := now();
  end if;
  if v_due_ts <= now() then
    return; -- la fecha ya pasó: no se genera un recordatorio extemporáneo
  end if;

  insert into public.vaccination_notifications
    (organization_id, clinic_id, vaccination_record_id, type, channel,
     recipient_name, recipient_email, payload, scheduled_for, idempotency_key)
  values
    (v_rec.organization_id, v_rec.clinic_id, v_rec.id, 'next_dose_due', 'email',
     v_owner.display_name, v_owner.email,
     jsonb_build_object(
       'pet_name', v_pet_name,
       'vaccine_name', v_rec.vaccine_name_snapshot,
       'next_due_at', v_rec.next_due_at,
       'clinic_name', v_clinic_name,
       'clinic_timezone', v_tz),
     v_scheduled,
     format('%s:%s:next_dose_due', v_rec.id,
            extract(epoch from v_due_ts)::bigint))
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public.enqueue_vaccination_reminder(uuid)
  from public, anon, authenticated;

create or replace function public.cancel_pending_vaccination_notifications(p_record_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.vaccination_notifications
  set status = 'cancelled'
  where vaccination_record_id = p_record_id
    and status = 'pending';
$$;

revoke all on function public.cancel_pending_vaccination_notifications(uuid)
  from public, anon, authenticated;

-- Procesamiento (mismo patrón que la agenda: FOR UPDATE SKIP LOCKED).
create or replace function public.claim_due_vaccination_notifications(
  p_clinic_id uuid,
  p_limit integer default 20
)
returns setof public.vaccination_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_clinic_operational_staff(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no procesa notificaciones de esta clínica.'
      using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'LIMITE_INVALIDO: entre 1 y 50.' using errcode = '22023';
  end if;

  return query
  update public.vaccination_notifications n
  set status = 'processing', attempts = n.attempts + 1
  where n.id in (
    select c.id from public.vaccination_notifications c
    where c.clinic_id = p_clinic_id
      and c.status = 'pending'
      and c.scheduled_for <= now()
    order by c.scheduled_for
    limit p_limit
    for update skip locked
  )
  returning n.*;
end;
$$;

create or replace function public.mark_vaccination_notification(
  p_notification_id uuid,
  p_ok boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic uuid;
  v_attempts smallint;
begin
  select n.clinic_id, n.attempts into v_clinic, v_attempts
  from public.vaccination_notifications n where n.id = p_notification_id;
  if not found then
    raise exception 'NOTIFICACION_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.is_clinic_operational_staff(v_clinic) then
    raise exception 'PERMISO_DENEGADO: tu rol no procesa notificaciones de esta clínica.'
      using errcode = '42501';
  end if;

  update public.vaccination_notifications
  set status = case
        when p_ok then 'sent'::public.notification_status
        when v_attempts >= 5 then 'failed'::public.notification_status
        else 'pending'::public.notification_status
      end,
      sent_at = case when p_ok then now() end,
      last_error = case when p_ok then null
                        else left(coalesce(p_error, 'error desconocido'), 500) end
  where id = p_notification_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPCs transaccionales
-- ----------------------------------------------------------------------------

-- Registrar una vacuna APLICADA EN CLÍNICA: solo veterinarios activos; hora
-- del servidor; lote y caducidad validados; idempotente por client_request_id.
create or replace function public.record_vaccination(
  p_clinic_id uuid,
  p_pet_id uuid,
  p_encounter_id uuid default null,
  p_vaccine_catalog_id uuid default null,
  p_vaccine_name text default null,
  p_manufacturer text default null,
  p_diseases text[] default null,
  p_lot_number text default null,
  p_lot_missing_reason text default null,
  p_expiration_date date default null,
  p_route_text text default null,
  p_application_site text default null,
  p_dose_text text default null,
  p_next_due_at date default null,
  p_notes text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_member uuid;
  v_org uuid;
  v_rel uuid;
  v_catalog public.vaccines_catalog%rowtype;
  v_name text;
  v_manufacturer text;
  v_diseases text[];
  v_lot text := nullif(btrim(coalesce(p_lot_number, '')), '');
  v_lot_reason text := nullif(btrim(coalesce(p_lot_missing_reason, '')), '');
  v_id uuid;
  v_content jsonb;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;

  select m.id into v_member from public.clinic_members m
  where m.clinic_id = p_clinic_id and m.user_id = v_user
    and m.role = 'veterinarian' and m.status = 'active' and m.deleted_at is null;
  if not found then
    raise exception 'PERMISO_DENEGADO: solo un veterinario activo registra aplicaciones en clínica.'
      using errcode = '42501';
  end if;

  select c.organization_id into v_org from public.clinics c where c.id = p_clinic_id;

  -- Idempotencia explícita: un doble clic devuelve el registro existente.
  if p_request_id is not null then
    select r.id into v_id from public.vaccination_records r
    where r.clinic_id = p_clinic_id and r.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;

  select r.id into v_rel from public.clinic_pet_relationships r
  where r.clinic_id = p_clinic_id and r.pet_id = p_pet_id
    and r.status = 'active' and r.deleted_at is null;
  if not found then
    raise exception 'MASCOTA_SIN_RELACION: la mascota no tiene relación activa con la clínica.'
      using errcode = '23514';
  end if;

  if p_vaccine_catalog_id is not null then
    select * into v_catalog from public.vaccines_catalog vc
    where vc.id = p_vaccine_catalog_id and vc.organization_id = v_org
      and vc.active and vc.deleted_at is null;
    if not found then
      raise exception 'PRODUCTO_NO_ENCONTRADO: el producto no está activo en el catálogo.'
        using errcode = 'P0002';
    end if;
  end if;

  -- Snapshot del producto: catálogo como base; la captura explícita prevalece.
  v_name := coalesce(nullif(btrim(coalesce(p_vaccine_name, '')), ''), v_catalog.name);
  if v_name is null then
    raise exception 'VACUNA_REQUERIDA: indica el producto del catálogo o su nombre.'
      using errcode = '22023';
  end if;
  v_manufacturer := coalesce(nullif(btrim(coalesce(p_manufacturer, '')), ''),
                             v_catalog.manufacturer);
  v_diseases := coalesce(p_diseases, v_catalog.diseases_covered, '{}');

  if v_lot is null and v_lot_reason is null then
    raise exception 'LOTE_REQUERIDO: captura el lote o justifica su ausencia.'
      using errcode = '23514';
  end if;
  if v_lot is not null and p_expiration_date is null then
    raise exception 'CADUCIDAD_REQUERIDA: captura la caducidad del lote.'
      using errcode = '23514';
  end if;
  if p_expiration_date is not null and p_expiration_date < current_date then
    raise exception 'PRODUCTO_CADUCADO: la caducidad es anterior a la fecha de aplicación.'
      using errcode = '23514';
  end if;
  if p_next_due_at is not null and p_next_due_at <= current_date then
    raise exception 'FECHA_INVALIDA: la próxima dosis debe ser futura.' using errcode = '23514';
  end if;

  begin
    insert into public.vaccination_records
      (organization_id, clinic_id, pet_id, clinic_pet_relationship_id, encounter_id,
       vaccine_catalog_id, source, vaccine_name_snapshot, manufacturer_snapshot,
       diseases_snapshot, lot_number, lot_missing_reason, expiration_date, administered_at,
       administered_by_clinic_member_id, route_text, application_site, dose_text,
       next_due_at, notes, client_request_id, created_by)
    values
      (v_org, p_clinic_id, p_pet_id, v_rel, p_encounter_id,
       p_vaccine_catalog_id, 'administered_in_clinic', v_name, v_manufacturer,
       v_diseases, v_lot, v_lot_reason, p_expiration_date, now(),
       v_member, nullif(btrim(coalesce(p_route_text, '')), ''),
       nullif(btrim(coalesce(p_application_site, '')), ''),
       nullif(btrim(coalesce(p_dose_text, '')), ''),
       p_next_due_at, nullif(btrim(coalesce(p_notes, '')), ''), p_request_id, v_user)
    returning id into v_id;
  exception
    when unique_violation then
      -- Doble envío concurrente con la misma clave: devolver el existente.
      select r.id into v_id from public.vaccination_records r
      where r.clinic_id = p_clinic_id and r.client_request_id = p_request_id;
      if v_id is null then
        raise;
      end if;
      return v_id;
  end;

  -- Comprobante individual congelado (fuente de verdad estructurada + hash).
  select jsonb_build_object(
      'template_version', 1,
      'record_id', r.id,
      'source', r.source,
      'vaccine_name', r.vaccine_name_snapshot,
      'manufacturer', r.manufacturer_snapshot,
      'diseases', r.diseases_snapshot,
      'lot_number', r.lot_number,
      'expiration_date', r.expiration_date,
      'administered_at', r.administered_at,
      'route_text', r.route_text,
      'application_site', r.application_site,
      'dose_text', r.dose_text,
      'next_due_at', r.next_due_at,
      'pet', jsonb_build_object('name', p.name, 'species', p.species, 'breed', p.breed,
                                'sex', p.sex, 'birth_date', p.birth_date),
      'veterinarian', jsonb_build_object(
        'display_name', coalesce(pr.display_name,
          nullif(btrim(concat(pr.first_name, ' ', pr.last_name)), '')),
        'professional_license', m.professional_license),
      'clinic', jsonb_build_object('name', c.name, 'phone', c.phone, 'city', c.city,
                                   'state', c.state))
    into v_content
  from public.vaccination_records r
  join public.pets p on p.id = r.pet_id
  join public.clinics c on c.id = r.clinic_id
  join public.clinic_members m on m.id = r.administered_by_clinic_member_id
  join public.profiles pr on pr.id = m.user_id
  where r.id = v_id;

  insert into public.vaccination_documents
    (vaccination_record_id, content, sha256, template_version, generated_by)
  values (v_id, v_content,
          encode(sha256(convert_to(v_content::text, 'UTF8')), 'hex'), 1, v_user);

  perform public.enqueue_vaccination_reminder(v_id);

  return v_id;
end;
$$;

-- Registrar una vacuna HISTÓRICA (aportada por el propietario, tercero,
-- campaña o importación): flujo separado y auditado; recepción autorizada.
-- Nunca se presenta como aplicación verificada por Dogtoralia.
create or replace function public.record_historical_vaccination(
  p_clinic_id uuid,
  p_pet_id uuid,
  p_source public.vaccination_source,
  p_vaccine_name text,
  p_administered_on date,
  p_manufacturer text default null,
  p_diseases text[] default null,
  p_lot_number text default null,
  p_expiration_date date default null,
  p_next_due_at date default null,
  p_provider_name text default null,
  p_document_reference text default null,
  p_document_path text default null,
  p_notes text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_rel uuid;
  v_tz text;
  v_name text := nullif(btrim(coalesce(p_vaccine_name, '')), '');
  v_is_vet boolean;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if p_source not in ('historical_owner_document', 'external_clinic', 'campaign', 'import') then
    raise exception 'FUENTE_INVALIDA: usa record_vaccination para aplicaciones en clínica.'
      using errcode = '22023';
  end if;

  -- Administración, veterinarios y recepción registran históricos (matriz de
  -- permisos); los asistentes no.
  if not exists (
    select 1 from public.clinic_members m
    where m.clinic_id = p_clinic_id and m.user_id = v_user
      and m.role in ('clinic_admin', 'veterinarian', 'receptionist')
      and m.status = 'active' and m.deleted_at is null
  ) then
    raise exception 'PERMISO_DENEGADO: tu rol no registra vacunas históricas en esta clínica.'
      using errcode = '42501';
  end if;

  select exists (
    select 1 from public.clinic_members m
    where m.clinic_id = p_clinic_id and m.user_id = v_user
      and m.role = 'veterinarian' and m.status = 'active' and m.deleted_at is null
  ) into v_is_vet;

  if v_name is null then
    raise exception 'VACUNA_REQUERIDA: indica el nombre de la vacuna.' using errcode = '22023';
  end if;
  if p_administered_on is null or p_administered_on > current_date then
    raise exception 'FECHA_INVALIDA: la fecha de aplicación debe existir y no ser futura.'
      using errcode = '23514';
  end if;
  -- La próxima dosis es decisión clínica: solo la confirma un veterinario.
  if p_next_due_at is not null and not v_is_vet then
    raise exception 'PROXIMA_DOSIS_SOLO_VETERINARIO: un veterinario debe confirmar la próxima dosis.'
      using errcode = '42501';
  end if;
  if p_next_due_at is not null and p_next_due_at <= p_administered_on then
    raise exception 'FECHA_INVALIDA: la próxima dosis debe ser posterior a la aplicación.'
      using errcode = '23514';
  end if;

  select c.organization_id, c.timezone into v_org, v_tz
  from public.clinics c where c.id = p_clinic_id;

  if p_request_id is not null then
    select r.id into v_id from public.vaccination_records r
    where r.clinic_id = p_clinic_id and r.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;

  select r.id into v_rel from public.clinic_pet_relationships r
  where r.clinic_id = p_clinic_id and r.pet_id = p_pet_id
    and r.status = 'active' and r.deleted_at is null;
  if not found then
    raise exception 'MASCOTA_SIN_RELACION: la mascota no tiene relación activa con la clínica.'
      using errcode = '23514';
  end if;

  if p_document_path is not null and p_document_path
     !~ ('^pets/' || p_pet_id || '/vaccinations/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$') then
    raise exception 'RUTA_INVALIDA: el comprobante no corresponde a la mascota.'
      using errcode = '22023';
  end if;

  begin
    insert into public.vaccination_records
      (organization_id, clinic_id, pet_id, clinic_pet_relationship_id,
       source, vaccine_name_snapshot, manufacturer_snapshot, diseases_snapshot,
       lot_number, expiration_date, administered_at, next_due_at,
       historical_provider_name, historical_document_reference, historical_document_path,
       notes, client_request_id, created_by)
    values
      (v_org, p_clinic_id, p_pet_id, v_rel,
       p_source, v_name, nullif(btrim(coalesce(p_manufacturer, '')), ''),
       coalesce(p_diseases, '{}'),
       nullif(btrim(coalesce(p_lot_number, '')), ''), p_expiration_date,
       ((p_administered_on::text || ' 12:00')::timestamp at time zone v_tz),
       p_next_due_at,
       nullif(btrim(coalesce(p_provider_name, '')), ''),
       nullif(btrim(coalesce(p_document_reference, '')), ''),
       p_document_path,
       nullif(btrim(coalesce(p_notes, '')), ''), p_request_id, v_user)
    returning id into v_id;
  exception
    when unique_violation then
      select r.id into v_id from public.vaccination_records r
      where r.clinic_id = p_clinic_id and r.client_request_id = p_request_id;
      if v_id is null then
        raise;
      end if;
      return v_id;
  end;

  if p_next_due_at is not null then
    perform public.enqueue_vaccination_reminder(v_id);
  end if;

  return v_id;
end;
$$;

-- Anulación: permiso elevado, motivo obligatorio, contenido intacto,
-- recordatorios pendientes cancelados.
create or replace function public.void_vaccination_record(
  p_record_id uuid,
  p_reason text
)
returns public.vaccination_record_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_rec public.vaccination_records%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_rec from public.vaccination_records r
  where r.id = p_record_id for update;
  if not found or v_rec.deleted_at is not null then
    raise exception 'REGISTRO_NO_ENCONTRADO' using errcode = 'P0002';
  end if;
  if v_rec.status = 'voided' then
    return 'voided'; -- idempotente
  end if;
  if v_reason is null then
    raise exception 'MOTIVO_REQUERIDO: la anulación requiere motivo.' using errcode = '22023';
  end if;
  if not public.is_organization_admin(v_rec.organization_id) then
    raise exception 'PERMISO_DENEGADO: solo administración de la organización anula registros.'
      using errcode = '42501';
  end if;

  perform set_config('app.vaccination_admin_op', 'void', true);
  perform set_config('app.vaccination_reason', v_reason, true);
  update public.vaccination_records
  set status = 'voided', voided_at = now(), voided_by = v_user, void_reason = v_reason
  where id = p_record_id;
  perform set_config('app.vaccination_admin_op', '', true);
  perform set_config('app.vaccination_reason', '', true);

  perform public.cancel_pending_vaccination_notifications(p_record_id);

  return 'voided';
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'record_vaccination(uuid, uuid, uuid, uuid, text, text, text[], text, text, date, text, text, text, date, text, uuid)',
    'record_historical_vaccination(uuid, uuid, public.vaccination_source, text, date, text, text[], text, date, date, text, text, text, text, uuid)',
    'void_vaccination_record(uuid, text)',
    'log_vaccination_access(uuid, text)',
    'claim_due_vaccination_notifications(uuid, integer)',
    'mark_vaccination_notification(uuid, boolean, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
