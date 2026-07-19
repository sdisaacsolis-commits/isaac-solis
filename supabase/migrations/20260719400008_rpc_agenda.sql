-- ============================================================================
-- Fase 5 — RPCs transaccionales de la agenda
-- ============================================================================
-- Todas las escrituras con invariantes de agenda pasan por aquí: los clientes
-- no tienen INSERT/UPDATE directo sobre citas ni horarios. SECURITY DEFINER,
-- search_path vacío, validación de permisos con las funciones de acceso y
-- errores con código estable (PREFIJO: descripción).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Crear servicio del catálogo (+ veterinarios asignados).
-- ----------------------------------------------------------------------------
create or replace function public.create_clinic_service(
  p_clinic_id uuid,
  p_name text,
  p_category public.service_category,
  p_duration_minutes smallint,
  p_price_cents integer,
  p_description text default null,
  p_buffer_before_minutes smallint default 0,
  p_buffer_after_minutes smallint default 0,
  p_requires_veterinarian boolean default true,
  p_veterinarian_member_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_service_id uuid;
  v_member uuid;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if not public.is_clinic_admin(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: solo administración configura el catálogo de servicios.'
      using errcode = '42501';
  end if;

  begin
    insert into public.clinic_services
      (organization_id, clinic_id, name, category, description, duration_minutes,
       buffer_before_minutes, buffer_after_minutes, price_cents,
       requires_veterinarian, created_by)
    values
      (public.organization_of_clinic(p_clinic_id), p_clinic_id, btrim(p_name), p_category,
       nullif(btrim(coalesce(p_description, '')), ''), p_duration_minutes,
       coalesce(p_buffer_before_minutes, 0), coalesce(p_buffer_after_minutes, 0),
       p_price_cents, coalesce(p_requires_veterinarian, true), v_user)
    returning id into v_service_id;
  exception
    when unique_violation then
      raise exception 'SERVICIO_DUPLICADO: ya existe un servicio activo con ese nombre.'
        using errcode = '23505';
  end;

  if p_veterinarian_member_ids is not null then
    foreach v_member in array p_veterinarian_member_ids loop
      insert into public.clinic_service_veterinarians
        (clinic_service_id, clinic_member_id, created_by)
      values (v_service_id, v_member, v_user)
      on conflict (clinic_service_id, clinic_member_id) do nothing;
    end loop;
  end if;

  return v_service_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Configurar el horario semanal de un profesional (reemplazo transaccional).
-- p_slots: [{"weekday":1,"start_time":"09:00","end_time":"14:00"}, …]
-- ----------------------------------------------------------------------------
create or replace function public.configure_veterinarian_schedule(
  p_clinic_id uuid,
  p_clinic_member_id uuid,
  p_slots jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_slot jsonb;
  v_count integer := 0;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if not public.is_clinic_admin(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: solo administración configura horarios.'
      using errcode = '42501';
  end if;
  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) > 40 then
    raise exception 'HORARIO_INVALIDO: se esperaba una lista de hasta 40 ventanas.'
      using errcode = '22023';
  end if;

  -- Reemplazo completo: las ventanas activas anteriores se desactivan (queda
  -- rastro en auditoría) y se insertan las nuevas en la misma transacción.
  update public.veterinarian_schedules
  set active = false
  where clinic_id = p_clinic_id
    and clinic_member_id = p_clinic_member_id
    and active;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    begin
      insert into public.veterinarian_schedules
        (organization_id, clinic_id, clinic_member_id, weekday, start_time, end_time, created_by)
      values
        (public.organization_of_clinic(p_clinic_id), p_clinic_id, p_clinic_member_id,
         (v_slot ->> 'weekday')::smallint,
         (v_slot ->> 'start_time')::time,
         (v_slot ->> 'end_time')::time,
         v_user);
    exception
      when exclusion_violation then
        raise exception 'HORARIO_TRASLAPADO: dos ventanas del mismo día se cruzan.'
          using errcode = '23P01';
      when invalid_text_representation or datetime_field_overflow then
        raise exception 'HORARIO_INVALIDO: ventana con formato incorrecto.'
          using errcode = '22023';
    end;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- Agendar una cita. Valida permisos, servicios, relaciones y horario;
-- calcula duración/colchones y folio; encola notificaciones. El anti-traslape
-- final lo garantiza el EXCLUDE (aquí solo se traduce el error).
-- ----------------------------------------------------------------------------
create or replace function public.book_appointment(
  p_clinic_id uuid,
  p_pet_id uuid,
  p_owner_id uuid,
  p_veterinarian_clinic_member_id uuid,
  p_service_ids uuid[],
  p_start timestamptz,
  p_source public.appointment_source default 'staff',
  p_reason text default null,
  p_emergency boolean default false,
  p_emergency_reason text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_tz text;
  v_duration integer := 0;
  v_buffer_before integer := 0;
  v_buffer_after integer := 0;
  v_end timestamptz;
  v_occupies_from timestamptz;
  v_occupies_until timestamptz;
  v_folio text;
  v_status public.appointment_status;
  v_appointment_id uuid;
  v_service record;
  v_service_count integer := 0;
  v_day date;
  v_in_schedule boolean;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;
  if not public.is_clinic_operational_staff(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no agenda citas en esta clínica.'
      using errcode = '42501';
  end if;
  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'SERVICIOS_REQUERIDOS: la cita necesita al menos un servicio.'
      using errcode = '22023';
  end if;
  if array_length(p_service_ids, 1) > 10 then
    raise exception 'SERVICIOS_EXCESIVOS: máximo 10 servicios por cita.' using errcode = '22023';
  end if;
  if p_emergency and nullif(btrim(coalesce(p_emergency_reason, '')), '') is null then
    raise exception 'MOTIVO_REQUERIDO: una urgencia requiere motivo.' using errcode = '22023';
  end if;
  if p_start < now() - interval '15 minutes' and p_source <> 'migration' then
    raise exception 'FECHA_PASADA: no se agenda en el pasado.' using errcode = '22023';
  end if;

  select c.timezone into v_tz from public.clinics c where c.id = p_clinic_id;

  -- Duración = suma de servicios; colchones = máximo entre servicios.
  for v_service in
    select s.* from public.clinic_services s
    where s.id = any (p_service_ids) and s.clinic_id = p_clinic_id and s.active
  loop
    v_duration := v_duration + v_service.duration_minutes;
    v_buffer_before := greatest(v_buffer_before, v_service.buffer_before_minutes);
    v_buffer_after := greatest(v_buffer_after, v_service.buffer_after_minutes);
    v_service_count := v_service_count + 1;
  end loop;
  if v_service_count <> array_length(p_service_ids, 1) then
    raise exception 'SERVICIO_INVALIDO: algún servicio no existe o no está activo en la clínica.'
      using errcode = 'P0002';
  end if;

  v_end := p_start + make_interval(mins => v_duration);
  v_occupies_from := p_start - make_interval(mins => v_buffer_before);
  v_occupies_until := v_end + make_interval(mins => v_buffer_after);

  -- Validación de horario laboral (ventana semanal vigente o special_hours).
  -- Urgencias y walk-ins pueden ir fuera de horario: quedan auditados.
  if not p_emergency and p_source <> 'walk_in' and p_source <> 'migration' then
    v_day := (p_start at time zone v_tz)::date;
    select exists (
      select 1 from public.veterinarian_schedules s
      where s.clinic_member_id = p_veterinarian_clinic_member_id
        and s.clinic_id = p_clinic_id
        and s.active
        and s.weekday = extract(isodow from v_day)::smallint
        and s.effective_from <= v_day
        and (s.effective_until is null or s.effective_until >= v_day)
        and ((v_day::timestamp + s.start_time) at time zone v_tz) <= p_start
        and ((v_day::timestamp + s.end_time) at time zone v_tz) >= v_end
      union
      select 1 from public.schedule_exceptions e
      where e.clinic_member_id = p_veterinarian_clinic_member_id
        and e.clinic_id = p_clinic_id
        and e.type = 'special_hours'
        and e.starts_at <= p_start
        and e.ends_at >= v_end
    ) into v_in_schedule;
    if not v_in_schedule then
      raise exception 'FUERA_DE_HORARIO: el profesional no atiende en ese horario.'
        using errcode = '23514';
    end if;
    if exists (
      select 1 from public.schedule_exceptions e
      where e.clinic_id = p_clinic_id
        and e.type <> 'special_hours'
        and (e.clinic_member_id is null
             or e.clinic_member_id = p_veterinarian_clinic_member_id)
        and tstzrange(e.starts_at, e.ends_at, '[)')
            && tstzrange(v_occupies_from, v_occupies_until, '[)')
    ) then
      raise exception 'NO_DISPONIBLE: hay una excepción de agenda en ese horario.'
        using errcode = '23514';
    end if;
  end if;

  -- Estado inicial según origen.
  v_status := case
    when p_source = 'walk_in' then 'checked_in'::public.appointment_status
    when p_source in ('owner_portal', 'mobile_app', 'whatsapp')
      then 'requested'::public.appointment_status
    else 'confirmed'::public.appointment_status
  end;

  v_folio := public.next_appointment_folio(
    p_clinic_id, extract(year from (p_start at time zone v_tz))::smallint);

  perform set_config('app.appointment_reason',
    coalesce(nullif(btrim(coalesce(p_reason, '')), ''), ''), true);

  begin
    insert into public.appointments
      (organization_id, clinic_id, folio, pet_id, owner_id,
       veterinarian_clinic_member_id, status, source,
       scheduled_start, scheduled_end, occupies_from, occupies_until,
       reason, staff_notes, emergency, emergency_reason, checked_in_at, created_by)
    values
      (public.organization_of_clinic(p_clinic_id), p_clinic_id, v_folio, p_pet_id, p_owner_id,
       p_veterinarian_clinic_member_id, v_status, p_source,
       p_start, v_end, v_occupies_from, v_occupies_until,
       nullif(btrim(coalesce(p_reason, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
       coalesce(p_emergency, false), nullif(btrim(coalesce(p_emergency_reason, '')), ''),
       case when v_status = 'checked_in' then now() end, v_user)
    returning id into v_appointment_id;
  exception
    when exclusion_violation then
      raise exception 'HORARIO_OCUPADO: el profesional ya tiene una cita que se cruza.'
        using errcode = '23P01';
  end;

  insert into public.appointment_services
    (appointment_id, clinic_service_id, service_name, category,
     duration_minutes, price_cents, currency, quantity)
  select v_appointment_id, s.id, s.name, s.category, s.duration_minutes,
         s.price_cents, s.currency, 1
  from public.clinic_services s
  where s.id = any (p_service_ids) and s.clinic_id = p_clinic_id;

  if v_status = 'confirmed' then
    perform public.enqueue_appointment_notifications(v_appointment_id, 'confirmation');
  end if;

  return v_appointment_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Transicionar el estado de una cita (máquina de estados + efectos).
-- ----------------------------------------------------------------------------
create or replace function public.transition_appointment_status(
  p_appointment_id uuid,
  p_new_status public.appointment_status,
  p_reason text default null
)
returns public.appointment_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_appt public.appointments%rowtype;
  v_is_vet_or_admin boolean;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;

  select * into v_appt from public.appointments a where a.id = p_appointment_id;
  if not found then
    raise exception 'CITA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.is_clinic_operational_staff(v_appt.clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no gestiona citas en esta clínica.'
      using errcode = '42501';
  end if;

  if not public.appointment_transition_allowed(v_appt.status, p_new_status) then
    raise exception 'TRANSICION_INVALIDA: % → % no está permitida.', v_appt.status, p_new_status
      using errcode = '23514';
  end if;

  -- Iniciar/terminar la atención es acto clínico: veterinario o administración.
  if p_new_status in ('in_progress', 'completed') then
    select public.is_clinic_admin(v_appt.clinic_id)
      or exists (
        select 1 from public.clinic_members m
        where m.clinic_id = v_appt.clinic_id
          and m.user_id = v_user
          and m.role = 'veterinarian'
          and m.status = 'active'
          and m.deleted_at is null
      )
    into v_is_vet_or_admin;
    if not v_is_vet_or_admin then
      raise exception 'PERMISO_DENEGADO: solo veterinarios o administración registran la atención.'
        using errcode = '42501';
    end if;
  end if;

  if p_new_status = 'cancelled' and v_reason is null then
    raise exception 'MOTIVO_REQUERIDO: la cancelación requiere motivo.' using errcode = '22023';
  end if;

  perform set_config('app.appointment_reason', coalesce(v_reason, ''), true);

  update public.appointments
  set status = p_new_status,
      checked_in_at = case when p_new_status = 'checked_in' then now() else checked_in_at end,
      started_at = case when p_new_status = 'in_progress' then now() else started_at end,
      completed_at = case when p_new_status = 'completed' then now() else completed_at end,
      cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end,
      cancelled_by = case when p_new_status = 'cancelled' then v_user else cancelled_by end,
      cancellation_reason = case when p_new_status = 'cancelled' then v_reason
                                 else cancellation_reason end,
      no_show_at = case when p_new_status = 'no_show' then now() else no_show_at end
  where id = p_appointment_id;

  if p_new_status = 'completed' then
    -- Efecto transaccional sobre la relación clínica↔mascota.
    update public.clinic_pet_relationships
    set last_visit_at = now(),
        first_visit_at = coalesce(first_visit_at, now())
    where clinic_id = v_appt.clinic_id
      and pet_id = v_appt.pet_id
      and status = 'active'
      and deleted_at is null;
  elsif p_new_status = 'cancelled' then
    perform public.cancel_pending_appointment_notifications(p_appointment_id);
    perform public.enqueue_appointment_notifications(p_appointment_id, 'cancellation');
  elsif p_new_status = 'no_show' then
    perform public.cancel_pending_appointment_notifications(p_appointment_id);
  elsif p_new_status = 'confirmed' then
    perform public.enqueue_appointment_notifications(p_appointment_id, 'confirmation');
  end if;

  return p_new_status;
end;
$$;

-- ----------------------------------------------------------------------------
-- Reagendar: MISMA cita (folio e identidad se conservan), nuevo horario y
-- opcionalmente otro profesional. El cambio queda en audit_log y se
-- renuevan las notificaciones.
-- ----------------------------------------------------------------------------
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_start timestamptz,
  p_new_veterinarian_clinic_member_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_appt public.appointments%rowtype;
  v_vet uuid;
  v_duration integer;
  v_buffer_before integer;
  v_buffer_after integer;
  v_end timestamptz;
  v_occupies_from timestamptz;
  v_occupies_until timestamptz;
  v_tz text;
  v_day date;
  v_in_schedule boolean;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión.' using errcode = '42501';
  end if;

  select * into v_appt from public.appointments a where a.id = p_appointment_id;
  if not found then
    raise exception 'CITA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.is_clinic_operational_staff(v_appt.clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no gestiona citas en esta clínica.'
      using errcode = '42501';
  end if;
  if v_appt.status not in ('requested', 'pending_confirmation', 'confirmed') then
    raise exception 'ESTADO_INVALIDO: solo se reagendan citas aún no iniciadas.'
      using errcode = '23514';
  end if;
  if p_new_start < now() - interval '15 minutes' then
    raise exception 'FECHA_PASADA: no se reagenda hacia el pasado.' using errcode = '22023';
  end if;

  v_vet := coalesce(p_new_veterinarian_clinic_member_id, v_appt.veterinarian_clinic_member_id);

  -- Duración desde los snapshots; colchones desde el catálogo actual.
  select coalesce(sum(aps.duration_minutes * aps.quantity), 30),
         coalesce(max(s.buffer_before_minutes), 0),
         coalesce(max(s.buffer_after_minutes), 0)
  into v_duration, v_buffer_before, v_buffer_after
  from public.appointment_services aps
  join public.clinic_services s on s.id = aps.clinic_service_id
  where aps.appointment_id = p_appointment_id;

  v_end := p_new_start + make_interval(mins => v_duration);
  v_occupies_from := p_new_start - make_interval(mins => v_buffer_before);
  v_occupies_until := v_end + make_interval(mins => v_buffer_after);

  select c.timezone into v_tz from public.clinics c where c.id = v_appt.clinic_id;

  if not v_appt.emergency then
    v_day := (p_new_start at time zone v_tz)::date;
    select exists (
      select 1 from public.veterinarian_schedules s
      where s.clinic_member_id = v_vet
        and s.clinic_id = v_appt.clinic_id
        and s.active
        and s.weekday = extract(isodow from v_day)::smallint
        and s.effective_from <= v_day
        and (s.effective_until is null or s.effective_until >= v_day)
        and ((v_day::timestamp + s.start_time) at time zone v_tz) <= p_new_start
        and ((v_day::timestamp + s.end_time) at time zone v_tz) >= v_end
      union
      select 1 from public.schedule_exceptions e
      where e.clinic_member_id = v_vet
        and e.clinic_id = v_appt.clinic_id
        and e.type = 'special_hours'
        and e.starts_at <= p_new_start
        and e.ends_at >= v_end
    ) into v_in_schedule;
    if not v_in_schedule then
      raise exception 'FUERA_DE_HORARIO: el profesional no atiende en ese horario.'
        using errcode = '23514';
    end if;
  end if;

  begin
    update public.appointments
    set scheduled_start = p_new_start,
        scheduled_end = v_end,
        occupies_from = v_occupies_from,
        occupies_until = v_occupies_until,
        veterinarian_clinic_member_id = v_vet,
        staff_notes = case
          when nullif(btrim(coalesce(p_reason, '')), '') is null then staff_notes
          else concat_ws(e'\n', staff_notes,
                         format('Reagendada: %s', btrim(p_reason)))
        end
    where id = p_appointment_id;
  exception
    when exclusion_violation then
      raise exception 'HORARIO_OCUPADO: el profesional ya tiene una cita que se cruza.'
        using errcode = '23P01';
  end;

  perform public.cancel_pending_appointment_notifications(p_appointment_id);
  perform public.enqueue_appointment_notifications(p_appointment_id, 'reschedule');

  return p_appointment_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Cancelar (azúcar sobre la transición; el motivo es obligatorio).
-- ----------------------------------------------------------------------------
create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text
)
returns public.appointment_status
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.transition_appointment_status(p_appointment_id, 'cancelled', p_reason);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'create_clinic_service(uuid, text, public.service_category, smallint, integer, text, smallint, smallint, boolean, uuid[])',
    'configure_veterinarian_schedule(uuid, uuid, jsonb)',
    'book_appointment(uuid, uuid, uuid, uuid, uuid[], timestamptz, public.appointment_source, text, boolean, text, text)',
    'transition_appointment_status(uuid, public.appointment_status, text)',
    'reschedule_appointment(uuid, timestamptz, uuid, text)',
    'cancel_appointment(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
