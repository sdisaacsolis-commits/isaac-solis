-- ============================================================================
-- pgTAP 15 — Fase 9: recordatorios automáticos (backend programado)
-- ============================================================================
-- Cubre: registro de tokens push (device_tokens) con aislamiento por dueño;
-- procesamiento batch cross-clínica reservado a service_role (authenticated
-- denegado); reintentos limitados (≤5) con estado terminal; e idempotencia del
-- outbox (una intención no se encola dos veces).
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

create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
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
  ('00000000-0000-4000-8000-0000000009a1', 'admin.rec@ejemplo.mx'),
  ('00000000-0000-4000-8000-0000000009a4', 'vet.rec@ejemplo.mx'),
  ('00000000-0000-4000-8000-0000000009a5', 'recepcion.rec@ejemplo.mx'),
  ('00000000-0000-4000-8000-0000000009b1', 'otro.rec@ejemplo.mx');

select pg_temp.login('00000000-0000-4000-8000-0000000009a1');
select set_config('vars.org',
  public.create_organization_with_owner('Veterinaria Recordatorio')::text, true);
select set_config('vars.clinic', public.create_clinic_with_admin(
  current_setting('vars.org')::uuid, 'Clínica Recordatorio')::text, true);

select pg_temp.logout();
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.org')::uuid, '00000000-0000-4000-8000-0000000009a4',
   'member', 'active', now(), '00000000-0000-4000-8000-0000000009a1'),
  (current_setting('vars.org')::uuid, '00000000-0000-4000-8000-0000000009a5',
   'member', 'active', now(), '00000000-0000-4000-8000-0000000009a1');
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.clinic')::uuid, '00000000-0000-4000-8000-0000000009a4',
   'veterinarian', 'active', now(), '00000000-0000-4000-8000-0000000009a1'),
  (current_setting('vars.clinic')::uuid, '00000000-0000-4000-8000-0000000009a5',
   'receptionist', 'active', now(), '00000000-0000-4000-8000-0000000009a1');

select set_config('vars.vet',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic')::uuid
     and user_id = '00000000-0000-4000-8000-0000000009a4'), true);

select pg_temp.login('00000000-0000-4000-8000-0000000009a1');
select set_config('vars.svc', public.create_clinic_service(
  current_setting('vars.clinic')::uuid, 'Consulta general', 'consultation',
  30::smallint, 50000, null, 0::smallint, 0::smallint, true,
  array[current_setting('vars.vet')::uuid])::text, true);
select public.configure_veterinarian_schedule(
  current_setting('vars.clinic')::uuid, current_setting('vars.vet')::uuid,
  '[{"weekday":1,"start_time":"09:00","end_time":"18:00"}]'::jsonb);

select pg_temp.login('00000000-0000-4000-8000-0000000009a5');
select set_config('vars.owner', public.register_owner_with_clinic(
  current_setting('vars.clinic')::uuid, 'Lucía', 'Reyes',
  'lucia@ejemplo.mx', '+525599998888')::text, true);
select set_config('vars.pet', public.register_pet_with_relationships(
  current_setting('vars.clinic')::uuid, current_setting('vars.owner')::uuid,
  'Motas', 'dog')::text, true);
select set_config('vars.cita', public.book_appointment(
  current_setting('vars.clinic')::uuid, current_setting('vars.pet')::uuid,
  current_setting('vars.owner')::uuid, current_setting('vars.vet')::uuid,
  array[current_setting('vars.svc')::uuid],
  '2027-03-01 10:00-06', 'staff', 'Revisión')::text, true);

-- ----------------------------------------------------------------------------
-- device_tokens: registro y aislamiento por dueño
-- ----------------------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-0000000009a1');
select lives_ok(
  $$select public.register_device_token('token-abc-1234567890', 'android')$$,
  'device_tokens 1: un usuario registra su token push'
);
select is(
  (select user_id from public.device_tokens where token = 'token-abc-1234567890'),
  '00000000-0000-4000-8000-0000000009a1'::uuid,
  'device_tokens 2: el token queda asociado al usuario autenticado'
);
select throws_ok(
  $$select public.register_device_token('corto', 'ios')$$,
  '22023',
  null,
  'device_tokens 3: un token demasiado corto se rechaza (TOKEN_INVALIDO)'
);

-- Otro usuario no ve ni administra el token ajeno (RLS por dueño).
select pg_temp.login('00000000-0000-4000-8000-0000000009b1');
select is(
  (select count(*)::int from public.device_tokens where token = 'token-abc-1234567890'),
  0, 'device_tokens 4: otro usuario NO ve el token ajeno (aislamiento RLS)'
);
select lives_ok(
  $$select public.unregister_device_token('token-abc-1234567890')$$,
  'device_tokens 5: dar de baja un token ajeno no lanza…'
);
select pg_temp.login('00000000-0000-4000-8000-0000000009a1');
select is(
  (select count(*)::int from public.device_tokens where token = 'token-abc-1234567890'),
  1, 'device_tokens 6: …pero NO lo borra (solo el dueño puede)'
);
select lives_ok(
  $$select public.unregister_device_token('token-abc-1234567890')$$,
  'device_tokens 7: el dueño da de baja su token'
);
select is(
  (select count(*)::int from public.device_tokens where token = 'token-abc-1234567890'),
  0, 'device_tokens 8: el token del dueño queda eliminado'
);

-- ----------------------------------------------------------------------------
-- Procesamiento batch: solo service_role
-- ----------------------------------------------------------------------------
-- Volver vencidos los recordatorios de la cita (como superusuario del fixture).
select pg_temp.logout();
update public.appointment_notifications
set scheduled_for = now() - interval '1 minute', status = 'pending'
where appointment_id = current_setting('vars.cita')::uuid;
select cmp_ok(
  (select count(*)::int from public.appointment_notifications
   where appointment_id = current_setting('vars.cita')::uuid), '>=', 1,
  'batch 0: la cita tiene al menos un recordatorio en el outbox'
);

-- Un usuario operativo NO puede usar las funciones batch (grant solo service_role).
select pg_temp.login('00000000-0000-4000-8000-0000000009a1');
select throws_ok(
  $$select public.claim_due_appointment_notifications_batch(10)$$,
  '42501',
  null,
  'batch 1: authenticated NO puede reclamar el batch cross-clínica'
);

-- service_role reclama las notificaciones vencidas de todas las clínicas.
select pg_temp.as_service();
select cmp_ok(
  (select count(*)::int from public.claim_due_appointment_notifications_batch(10)), '>=', 1,
  'batch 2: service_role reclama las notificaciones vencidas'
);
select is(
  (select status::text from public.appointment_notifications
   where appointment_id = current_setting('vars.cita')::uuid order by scheduled_for limit 1),
  'processing', 'batch 3: reclamar marca la notificación como processing'
);
select cmp_ok(
  (select attempts from public.appointment_notifications
   where appointment_id = current_setting('vars.cita')::uuid order by scheduled_for limit 1),
  '>=', 1::smallint, 'batch 4: reclamar incrementa attempts'
);

-- Marcar como enviada.
select set_config('vars.notif',
  (select id::text from public.appointment_notifications
   where appointment_id = current_setting('vars.cita')::uuid order by scheduled_for limit 1), true);
select lives_ok(
  format($$select public.mark_appointment_notification_by_service(%L, true)$$,
         current_setting('vars.notif')),
  'batch 5: service_role marca la notificación como enviada'
);
select is(
  (select status::text from public.appointment_notifications
   where id = current_setting('vars.notif')::uuid),
  'sent', 'batch 6: la notificación queda en sent'
);
select isnt(
  (select sent_at from public.appointment_notifications
   where id = current_setting('vars.notif')::uuid), null,
  'batch 7: sent_at queda registrado'
);

-- ----------------------------------------------------------------------------
-- Reintentos limitados (≤5) con estado terminal
-- ----------------------------------------------------------------------------
-- Fallar con pocos intentos → vuelve a pending (reintentable).
select pg_temp.logout();
update public.appointment_notifications
set status = 'processing', attempts = 2, sent_at = null, last_error = null
where id = current_setting('vars.notif')::uuid;
select pg_temp.as_service();
select lives_ok(
  format($$select public.mark_appointment_notification_by_service(%L, false, 'timeout del proveedor')$$,
         current_setting('vars.notif')),
  'reintentos 1: marcar fallo con 2 intentos'
);
select is(
  (select status::text from public.appointment_notifications
   where id = current_setting('vars.notif')::uuid),
  'pending', 'reintentos 2: con <5 intentos vuelve a pending (reintentable)'
);
select is(
  (select last_error from public.appointment_notifications
   where id = current_setting('vars.notif')::uuid),
  'timeout del proveedor', 'reintentos 3: se guarda el último error'
);

-- Agotar los reintentos → estado terminal failed.
select pg_temp.logout();
update public.appointment_notifications
set status = 'processing', attempts = 5
where id = current_setting('vars.notif')::uuid;
select pg_temp.as_service();
select lives_ok(
  format($$select public.mark_appointment_notification_by_service(%L, false, 'sigue fallando')$$,
         current_setting('vars.notif')),
  'reintentos 4: marcar fallo con 5 intentos'
);
select is(
  (select status::text from public.appointment_notifications
   where id = current_setting('vars.notif')::uuid),
  'failed', 'reintentos 5: con ≥5 intentos queda failed (terminal, visible)'
);

-- ----------------------------------------------------------------------------
-- Idempotencia del outbox: una intención no se encola dos veces
-- ----------------------------------------------------------------------------
select pg_temp.logout();
select set_config('vars.idem',
  (select idempotency_key from public.appointment_notifications
   where id = current_setting('vars.notif')::uuid), true);
select throws_ok(
  format($$insert into public.appointment_notifications
             (organization_id, clinic_id, appointment_id, type, channel,
              recipient_email, payload, scheduled_for, idempotency_key)
           select organization_id, clinic_id, appointment_id, type, channel,
                  recipient_email, payload, scheduled_for, %L
           from public.appointment_notifications where id = %L$$,
         current_setting('vars.idem'), current_setting('vars.notif')),
  '23505',
  null,
  'idempotencia: reencolar la misma intención (idempotency_key) viola UNIQUE'
);

select * from finish();
rollback;
