-- ============================================================================
-- Fase 9 — Recordatorios automáticos: backend de procesamiento programado
-- ============================================================================
-- El panel de clínica ya procesa su outbox con la sesión del usuario operativo
-- (RPCs claim/mark por clínica, jamás service_role en apps/web). Esta fase añade
-- el procesador PROGRAMADO (Edge Function `send-reminders` + cron): funciones
-- batch CROSS-CLÍNICA reservadas a `service_role` (grant explícito) que reclaman
-- y marcan las notificaciones vencidas de TODAS las clínicas, sin exigir un
-- usuario operativo. Reintentos limitados (≤5) y `FOR UPDATE SKIP LOCKED` para
-- evitar envíos dobles entre procesos. La idempotencia (nada se envía dos veces)
-- ya la garantiza `idempotency_key UNIQUE` de cada outbox.
--
-- Además se crea el REGISTRO DE TOKENS PUSH (`device_tokens`): base del canal
-- push (FCM) que consumirá la Edge Function y la app móvil (fase posterior). El
-- envío push a propietarios y la desparasitación quedan como seguimiento
-- ([Propuesta] en ROADMAP): sus tablas base (owner→user, dewormings) exceden el
-- alcance de esta fase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Registro de tokens de dispositivo (push / FCM)
-- ----------------------------------------------------------------------------
create type public.device_platform as enum ('ios', 'android', 'web');

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform public.device_platform not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un token identifica un dispositivo: es único globalmente y puede cambiar de
  -- dueño si el dispositivo se reasigna a otra cuenta.
  unique (token),
  constraint device_tokens_token_no_vacio check (length(btrim(token)) >= 10)
);

comment on table public.device_tokens is
  'Tokens de notificaciones push (FCM) por usuario/dispositivo. Datos personales: '
  'RLS por dueño; el procesador de recordatorios (service_role) los lee para enviar.';

create index device_tokens_user_idx on public.device_tokens (user_id);

create trigger device_tokens_set_updated_at
  before update on public.device_tokens
  for each row execute function public.set_updated_at();

alter table public.device_tokens enable row level security;
alter table public.device_tokens force row level security;

-- Cada persona administra EXCLUSIVAMENTE sus propios tokens.
create policy device_tokens_select_propio on public.device_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy device_tokens_insert_propio on public.device_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy device_tokens_update_propio on public.device_tokens
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy device_tokens_delete_propio on public.device_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- Registrar/actualizar el token del dispositivo del usuario autenticado.
create or replace function public.register_device_token(
  p_token text,
  p_platform public.device_platform
)
returns public.device_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row public.device_tokens;
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA: inicia sesión para registrar el dispositivo.'
      using errcode = '42501';
  end if;
  if p_token is null or length(btrim(p_token)) < 10 then
    raise exception 'TOKEN_INVALIDO: el token de push no es válido.' using errcode = '22023';
  end if;

  insert into public.device_tokens (user_id, token, platform, last_seen_at)
  values (v_user, btrim(p_token), p_platform, now())
  on conflict (token) do update
    set user_id = v_user,
        platform = excluded.platform,
        last_seen_at = now(),
        updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

-- Dar de baja el token (p. ej. cierre de sesión o desinstalación).
create or replace function public.unregister_device_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'AUTENTICACION_REQUERIDA' using errcode = '42501';
  end if;
  delete from public.device_tokens
  where token = btrim(p_token) and user_id = v_user;
end;
$$;

revoke all on function public.register_device_token(text, public.device_platform)
  from public, anon;
grant execute on function public.register_device_token(text, public.device_platform)
  to authenticated;
revoke all on function public.unregister_device_token(text) from public, anon;
grant execute on function public.unregister_device_token(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Procesamiento batch CROSS-CLÍNICA (solo service_role: Edge Function + cron)
-- ----------------------------------------------------------------------------
-- A diferencia de las RPCs por clínica del panel, estas NO exigen usuario
-- operativo: reclaman las notificaciones vencidas de todas las clínicas. El
-- acceso queda restringido por GRANT exclusivo a service_role.

create or replace function public.claim_due_appointment_notifications_batch(
  p_limit integer default 50
)
returns setof public.appointment_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'LIMITE_INVALIDO: entre 1 y 200.' using errcode = '22023';
  end if;

  return query
  update public.appointment_notifications n
  set status = 'processing', attempts = n.attempts + 1
  where n.id in (
    select c.id from public.appointment_notifications c
    where c.status = 'pending'
      and c.scheduled_for <= now()
    order by c.scheduled_for
    limit p_limit
    for update skip locked
  )
  returning n.*;
end;
$$;

create or replace function public.mark_appointment_notification_by_service(
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
  v_attempts smallint;
begin
  select n.attempts into v_attempts
  from public.appointment_notifications n where n.id = p_notification_id;
  if not found then
    raise exception 'NOTIFICACION_NO_ENCONTRADA' using errcode = 'P0002';
  end if;

  update public.appointment_notifications
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

create or replace function public.claim_due_vaccination_notifications_batch(
  p_limit integer default 50
)
returns setof public.vaccination_notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'LIMITE_INVALIDO: entre 1 y 200.' using errcode = '22023';
  end if;

  return query
  update public.vaccination_notifications n
  set status = 'processing', attempts = n.attempts + 1
  where n.id in (
    select c.id from public.vaccination_notifications c
    where c.status = 'pending'
      and c.scheduled_for <= now()
    order by c.scheduled_for
    limit p_limit
    for update skip locked
  )
  returning n.*;
end;
$$;

create or replace function public.mark_vaccination_notification_by_service(
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
  v_attempts smallint;
begin
  select n.attempts into v_attempts
  from public.vaccination_notifications n where n.id = p_notification_id;
  if not found then
    raise exception 'NOTIFICACION_NO_ENCONTRADA' using errcode = 'P0002';
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

-- Solo el backend programado (service_role) ejecuta el procesamiento batch.
do $$
declare
  f text;
begin
  foreach f in array array[
    'claim_due_appointment_notifications_batch(integer)',
    'mark_appointment_notification_by_service(uuid, boolean, text)',
    'claim_due_vaccination_notifications_batch(integer)',
    'mark_vaccination_notification_by_service(uuid, boolean, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
