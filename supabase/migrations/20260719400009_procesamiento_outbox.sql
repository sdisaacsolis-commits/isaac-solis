-- ============================================================================
-- Fase 5 — Procesamiento del outbox de notificaciones
-- ============================================================================
-- El panel procesa las notificaciones vencidas de SU clínica con la sesión
-- del usuario operativo (jamás service_role en apps/web): reclamar con
-- FOR UPDATE SKIP LOCKED evita dobles envíos entre pestañas/procesos.
-- Un procesador de backend (Edge Function con service_role + cron) podrá
-- usar estas mismas funciones en una fase posterior.
-- ============================================================================

create or replace function public.claim_due_appointment_notifications(
  p_clinic_id uuid,
  p_limit integer default 20
)
returns setof public.appointment_notifications
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
  update public.appointment_notifications n
  set status = 'processing', attempts = n.attempts + 1
  where n.id in (
    select c.id from public.appointment_notifications c
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

create or replace function public.mark_appointment_notification(
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
  from public.appointment_notifications n where n.id = p_notification_id;
  if not found then
    raise exception 'NOTIFICACION_NO_ENCONTRADA' using errcode = 'P0002';
  end if;
  if not public.is_clinic_operational_staff(v_clinic) then
    raise exception 'PERMISO_DENEGADO: tu rol no procesa notificaciones de esta clínica.'
      using errcode = '42501';
  end if;

  update public.appointment_notifications
  set status = case
        when p_ok then 'sent'::public.notification_status
        -- Reintentos limitados: tras 5 intentos queda en failed (visible).
        when v_attempts >= 5 then 'failed'::public.notification_status
        else 'pending'::public.notification_status
      end,
      sent_at = case when p_ok then now() end,
      last_error = case when p_ok then null else left(coalesce(p_error, 'error desconocido'), 500) end
  where id = p_notification_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'claim_due_appointment_notifications(uuid, integer)',
    'mark_appointment_notification(uuid, boolean, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
