-- ============================================================================
-- Fase 5 — Outbox de notificaciones de citas
-- ============================================================================
-- Patrón OUTBOX: las RPCs insertan la intención de notificar EN LA MISMA
-- transacción que crea/modifica la cita (consistencia), y un procesador
-- (Server Action tras la operación + endpoint con CRON_SECRET para
-- recordatorios) las envía después mediante la interfaz de proveedor.
-- Justificación frente a envío directo: si el envío fallara dentro de la
-- transacción habría citas sin confirmar o correos duplicados; el outbox da
-- reintentos, idempotencia y auditoría sin acoplar el dominio al proveedor.
-- Solo email se envía en esta fase; whatsapp/push/sms quedan preparados.
-- ============================================================================

create table public.appointment_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  type public.appointment_notification_type not null,
  channel public.notification_channel not null default 'email',
  recipient_name text,
  recipient_email text check (recipient_email is null or position('@' in recipient_email) > 1),
  -- Datos NO sensibles para armar la plantilla (folio, fechas, clínica…).
  -- Nunca datos clínicos: la notificación es operativa.
  payload jsonb not null default '{}'::jsonb,
  -- Para recordatorios: momento a partir del cual debe enviarse.
  scheduled_for timestamptz not null default now(),
  status public.notification_status not null default 'pending',
  attempts smallint not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  -- Idempotencia: una misma intención (cita+tipo+canal+versión de horario) no
  -- se encola ni envía dos veces aunque la RPC o el procesador se reintenten.
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key),
  constraint appointment_notifications_email_con_destinatario
    check (channel <> 'email' or recipient_email is not null)
);

comment on table public.appointment_notifications is
  'Outbox de notificaciones de citas (email hoy; whatsapp/push/sms preparados). Idempotente y con reintentos.';

create index appointment_notifications_pendientes_idx
  on public.appointment_notifications (scheduled_for)
  where status = 'pending';
create index appointment_notifications_cita_idx
  on public.appointment_notifications (appointment_id);

alter table public.appointment_notifications enable row level security;
alter table public.appointment_notifications force row level security;

create trigger appointment_notifications_set_updated_at
  before update on public.appointment_notifications
  for each row execute function public.set_updated_at();

create trigger appointment_notifications_enforce_organization
  before insert or update of clinic_id, organization_id on public.appointment_notifications
  for each row execute function public.enforce_clinic_organization();

-- ----------------------------------------------------------------------------
-- Encolar las notificaciones estándar de una cita (confirmación inmediata y
-- recordatorios 24h/2h si caen en el futuro). DEFINER interna: la llaman las
-- RPCs de agenda, nunca el cliente.
-- ----------------------------------------------------------------------------
create or replace function public.enqueue_appointment_notifications(
  p_appointment_id uuid,
  p_kind public.appointment_notification_type
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
  v_owner public.pet_owners%rowtype;
  v_clinic_name text;
  v_clinic_tz text;
  v_pet_name text;
  v_payload jsonb;
  v_key_base text;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id;
  if not found then
    raise exception 'CITA_NO_ENCONTRADA' using errcode = 'P0002';
  end if;

  select * into v_owner from public.pet_owners o where o.id = v_appt.owner_id;
  select c.name, c.timezone into v_clinic_name, v_clinic_tz
  from public.clinics c where c.id = v_appt.clinic_id;
  select p.name into v_pet_name from public.pets p where p.id = v_appt.pet_id;

  v_payload := jsonb_build_object(
    'folio', v_appt.folio,
    'clinic_name', v_clinic_name,
    'clinic_timezone', v_clinic_tz,
    'pet_name', v_pet_name,
    'scheduled_start', v_appt.scheduled_start,
    'scheduled_end', v_appt.scheduled_end
  );

  -- La clave incluye el horario: al reagendar se generan claves nuevas y las
  -- intenciones previas quedan canceladas por la RPC correspondiente.
  v_key_base := format('%s:%s', v_appt.id, extract(epoch from v_appt.scheduled_start)::bigint);

  -- Sin correo del propietario no hay canal disponible en esta fase: se omite
  -- silenciosamente (el panel siempre muestra la cita; el correo es cortesía).
  if v_owner.email is null then
    return;
  end if;

  if p_kind in ('confirmation', 'reschedule', 'cancellation') then
    insert into public.appointment_notifications
      (organization_id, clinic_id, appointment_id, type, channel,
       recipient_name, recipient_email, payload, scheduled_for, idempotency_key)
    values
      (v_appt.organization_id, v_appt.clinic_id, v_appt.id, p_kind, 'email',
       v_owner.display_name, v_owner.email, v_payload, now(),
       format('%s:%s', v_key_base, p_kind))
    on conflict (idempotency_key) do nothing;
  end if;

  -- Recordatorios solo al confirmar/reagendar y solo si aún son futuros.
  if p_kind in ('confirmation', 'reschedule') then
    if v_appt.scheduled_start - interval '24 hours' > now() then
      insert into public.appointment_notifications
        (organization_id, clinic_id, appointment_id, type, channel,
         recipient_name, recipient_email, payload, scheduled_for, idempotency_key)
      values
        (v_appt.organization_id, v_appt.clinic_id, v_appt.id, 'reminder_24h', 'email',
         v_owner.display_name, v_owner.email, v_payload,
         v_appt.scheduled_start - interval '24 hours',
         format('%s:reminder_24h', v_key_base))
      on conflict (idempotency_key) do nothing;
    end if;
    if v_appt.scheduled_start - interval '2 hours' > now() then
      insert into public.appointment_notifications
        (organization_id, clinic_id, appointment_id, type, channel,
         recipient_name, recipient_email, payload, scheduled_for, idempotency_key)
      values
        (v_appt.organization_id, v_appt.clinic_id, v_appt.id, 'reminder_2h', 'email',
         v_owner.display_name, v_owner.email, v_payload,
         v_appt.scheduled_start - interval '2 hours',
         format('%s:reminder_2h', v_key_base))
      on conflict (idempotency_key) do nothing;
    end if;
  end if;
end;
$$;

revoke all on function public.enqueue_appointment_notifications(uuid, public.appointment_notification_type)
  from public, anon, authenticated;

-- Cancela intenciones pendientes de una cita (al cancelar o reagendar).
create or replace function public.cancel_pending_appointment_notifications(p_appointment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.appointment_notifications
  set status = 'cancelled'
  where appointment_id = p_appointment_id
    and status = 'pending'
    and type in ('reminder_24h', 'reminder_2h');
$$;

revoke all on function public.cancel_pending_appointment_notifications(uuid)
  from public, anon, authenticated;
