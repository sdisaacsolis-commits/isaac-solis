-- ============================================================================
-- Fase 5 — Cálculo de disponibilidad (slots) por profesional y servicio
-- ============================================================================
-- Reglas:
--   * Rango máximo de consulta: 31 días (protección de carga).
--   * Rejilla de 15 minutos dentro de las ventanas del horario semanal
--     vigente, más ventanas special_hours.
--   * Se descartan slots que crucen excepciones bloqueantes (propias o de
--     toda la clínica) o citas existentes en estados que ocupan agenda,
--     considerando los colchones del servicio (misma ventana que el EXCLUDE).
--   * Las horas del horario semanal son hora local de la clínica; el
--     resultado son timestamptz (UTC) listos para presentar en su zona.
-- ============================================================================

create or replace function public.get_available_slots(
  p_clinic_id uuid,
  p_veterinarian_clinic_member_id uuid,
  p_clinic_service_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_duration int;
  v_buffer_before int;
  v_buffer_after int;
  v_day date;
  v_window record;
  v_slot timestamptz;
  v_slot_end timestamptz;
  v_occupies_from timestamptz;
  v_occupies_until timestamptz;
  v_window_start timestamptz;
  v_window_end timestamptz;
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: no eres miembro de la clínica' using errcode = '42501';
  end if;

  if p_to_date < p_from_date or p_to_date - p_from_date > 31 then
    raise exception 'RANGO_EXCESIVO: consulta entre 1 y 31 días' using errcode = '22023';
  end if;

  select c.timezone into v_tz from public.clinics c where c.id = p_clinic_id;
  if v_tz is null then
    raise exception 'CLINICA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;

  select s.duration_minutes, s.buffer_before_minutes, s.buffer_after_minutes
  into v_duration, v_buffer_before, v_buffer_after
  from public.clinic_services s
  where s.id = p_clinic_service_id and s.clinic_id = p_clinic_id and s.active;
  if not found then
    raise exception 'SERVICIO_INVALIDO: el servicio no existe o no está activo en la clínica'
      using errcode = 'P0002';
  end if;

  v_day := p_from_date;
  while v_day <= p_to_date loop
    for v_window in
      -- Ventanas del horario semanal vigente para ese día…
      select ((v_day::timestamp + s.start_time) at time zone v_tz) as w_start,
             ((v_day::timestamp + s.end_time) at time zone v_tz) as w_end
      from public.veterinarian_schedules s
      where s.clinic_member_id = p_veterinarian_clinic_member_id
        and s.clinic_id = p_clinic_id
        and s.active
        and s.weekday = extract(isodow from v_day)::smallint
        and s.effective_from <= v_day
        and (s.effective_until is null or s.effective_until >= v_day)
      union all
      -- …más horarios especiales (special_hours agrega disponibilidad).
      select greatest(e.starts_at, (v_day::timestamp at time zone v_tz)),
             least(e.ends_at, ((v_day + 1)::timestamp at time zone v_tz))
      from public.schedule_exceptions e
      where e.clinic_member_id = p_veterinarian_clinic_member_id
        and e.clinic_id = p_clinic_id
        and e.type = 'special_hours'
        and e.starts_at < ((v_day + 1)::timestamp at time zone v_tz)
        and e.ends_at > (v_day::timestamp at time zone v_tz)
    loop
      v_window_start := v_window.w_start;
      v_window_end := v_window.w_end;
      v_slot := v_window_start;

      while v_slot + make_interval(mins => v_duration) <= v_window_end loop
        v_slot_end := v_slot + make_interval(mins => v_duration);
        v_occupies_from := v_slot - make_interval(mins => v_buffer_before);
        v_occupies_until := v_slot_end + make_interval(mins => v_buffer_after);

        if v_slot > now()
          -- Sin excepciones bloqueantes que crucen la ventana ocupada.
          and not exists (
            select 1 from public.schedule_exceptions e
            where e.clinic_id = p_clinic_id
              and e.type <> 'special_hours'
              and (e.clinic_member_id is null
                   or e.clinic_member_id = p_veterinarian_clinic_member_id)
              and tstzrange(e.starts_at, e.ends_at, '[)')
                  && tstzrange(v_occupies_from, v_occupies_until, '[)')
          )
          -- Sin citas que ocupen agenda en ese rango (misma regla que EXCLUDE).
          and not exists (
            select 1 from public.appointments a
            where a.veterinarian_clinic_member_id = p_veterinarian_clinic_member_id
              and a.status in ('pending_confirmation', 'confirmed', 'checked_in', 'in_progress')
              and tstzrange(a.occupies_from, a.occupies_until, '[)')
                  && tstzrange(v_occupies_from, v_occupies_until, '[)')
          )
        then
          slot_start := v_slot;
          slot_end := v_slot_end;
          return next;
        end if;

        v_slot := v_slot + interval '15 minutes';
      end loop;
    end loop;
    v_day := v_day + 1;
  end loop;

  return;
end;
$$;

revoke all on function public.get_available_slots(uuid, uuid, uuid, date, date) from public, anon;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date, date)
  to authenticated, service_role;
