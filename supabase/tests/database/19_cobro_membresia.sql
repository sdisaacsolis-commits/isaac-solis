-- ============================================================================
-- pgTAP 19 — Fase 13: cobro de membresía
-- ============================================================================
-- Verifica el modelo comercial activado: planes Profesional (mensual y anual)
-- a <50% de la referencia de mercado; prueba de 14 días para clínicas nuevas;
-- vigencia (`clinic_subscription_is_current`) con tolerancia de 7 días en
-- past_due; y el SOLO LECTURA al vencer: las escrituras operativas del personal
-- se bloquean en la BD (SUSCRIPCION_VENCIDA) sin tocar jamás los datos, y el
-- backend (service_role, sin uid) nunca queda bloqueado.
-- ============================================================================
begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
declare v_email text;
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

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000013a1', 'admin.a@cobro.mx');

select pg_temp.login('00000000-0000-4000-8000-0000000013a1');
select set_config('vars.org', public.create_organization_with_owner('Cobro Org')::text, true);
select set_config('vars.clinic',
  public.create_clinic_with_admin(current_setting('vars.org')::uuid, 'Cobro Clínica')::text, true);

-- ----------------------------------------------------------------------------
-- Catálogo comercial
-- ----------------------------------------------------------------------------
select results_eq(
  $$select price_cents, billing_interval::text, included_veterinarians,
           additional_veterinarian_price_cents
    from public.plans where code = 'profesional'$$,
  $$values (59900, 'month', 1, 39900)$$,
  'planes 1: Profesional mensual — $599 con 1 vet incluido y $399 por vet adicional'
);
select results_eq(
  $$select price_cents, billing_interval::text, included_veterinarians,
           additional_veterinarian_price_cents
    from public.plans where code = 'profesional_anual'$$,
  $$values (599000, 'year', 1, 399000)$$,
  'planes 2: Profesional anual — $5,990 (2 meses gratis) y $3,990 por vet adicional'
);
-- La RLS de planes solo muestra los activos a authenticated/anon, así que la
-- bandera de beta se verifica sin sesión (rol de pruebas, sin RLS).
select pg_temp.logout();
select ok(
  not (select is_active from public.plans where code = 'beta'),
  'planes 3: el plan beta deja de ofrecerse (is_active = false)'
);
select pg_temp.login('00000000-0000-4000-8000-0000000013a1');

-- ----------------------------------------------------------------------------
-- Alta por defecto: prueba de 14 días del plan Profesional
-- ----------------------------------------------------------------------------
select is(
  (select p.code from public.subscriptions s join public.plans p on p.id = s.plan_id
   where s.clinic_id = current_setting('vars.clinic')::uuid),
  'profesional', 'alta 1: una clínica nueva nace en el plan Profesional'
);
select is(
  (select status::text from public.subscriptions
   where clinic_id = current_setting('vars.clinic')::uuid),
  'trialing', 'alta 2: la suscripción nace en prueba (trialing)'
);
select ok(
  (select current_period_end between now() + interval '13 days' and now() + interval '15 days'
   from public.subscriptions
   where clinic_id = current_setting('vars.clinic')::uuid),
  'alta 3: la prueba dura 14 días'
);

-- ----------------------------------------------------------------------------
-- Vigencia y solo lectura
-- ----------------------------------------------------------------------------
select ok(
  public.clinic_subscription_is_current(current_setting('vars.clinic')::uuid),
  'vigencia 1: en prueba vigente, la suscripción cuenta como activa'
);

-- Con la prueba vigente, el personal SÍ escribe (RPC real del catálogo).
select lives_ok(
  $$select public.create_clinic_service(current_setting('vars.clinic')::uuid,
      'Consulta general', 'consultation', 30::smallint, 45000)$$,
  'vigencia 2: con suscripción vigente las escrituras operativas funcionan'
);

-- Vence el periodo (backend ajusta el estado; el personal queda en solo lectura).
select pg_temp.logout();
update public.subscriptions
set status = 'active',
    current_period_start = now() - interval '31 days',
    current_period_end = now() - interval '1 day'
where clinic_id = current_setting('vars.clinic')::uuid;

select pg_temp.login('00000000-0000-4000-8000-0000000013a1');
select ok(
  not public.clinic_subscription_is_current(current_setting('vars.clinic')::uuid),
  'vigencia 3: con el periodo vencido, la suscripción NO está vigente'
);
select throws_like(
  $$select public.create_clinic_service(current_setting('vars.clinic')::uuid,
      'Vacunación', 'vaccination', 20::smallint, 35000)$$,
  '%SUSCRIPCION_VENCIDA%',
  'vigencia 4: vencida, la escritura del personal se bloquea en la BD (solo lectura)'
);
-- La lectura sigue funcionando: los datos no se tocan.
select is(
  (select count(*)::int from public.clinic_services
   where clinic_id = current_setting('vars.clinic')::uuid),
  1, 'vigencia 5: vencida, la LECTURA sigue disponible (solo lectura real)'
);

-- Tolerancia past_due: hasta 7 días tras el fin del periodo (reintentos de cobro).
select pg_temp.logout();
update public.subscriptions
set status = 'past_due', current_period_end = now() - interval '3 days'
where clinic_id = current_setting('vars.clinic')::uuid;
select pg_temp.login('00000000-0000-4000-8000-0000000013a1');
select ok(
  public.clinic_subscription_is_current(current_setting('vars.clinic')::uuid),
  'vigencia 6: past_due dentro de los 7 días de tolerancia sigue vigente'
);
select pg_temp.logout();
update public.subscriptions
set current_period_end = now() - interval '10 days'
where clinic_id = current_setting('vars.clinic')::uuid;
select pg_temp.login('00000000-0000-4000-8000-0000000013a1');
select ok(
  not public.clinic_subscription_is_current(current_setting('vars.clinic')::uuid),
  'vigencia 7: past_due más allá de la tolerancia deja de estar vigente'
);

-- El backend (sin usuario autenticado) NUNCA queda bloqueado, aun vencida.
select pg_temp.logout();
select lives_ok(
  $$insert into public.clinic_services
      (organization_id, clinic_id, name, category, duration_minutes, price_cents)
    values (current_setting('vars.org')::uuid, current_setting('vars.clinic')::uuid,
            'Ajuste de backend', 'other', 15::smallint, 0)$$,
  'vigencia 8: el backend (service/cron/webhook, sin uid) no se bloquea nunca'
);

-- Reactivación: el webhook marca active con periodo futuro y todo vuelve.
update public.subscriptions
set status = 'active', current_period_end = now() + interval '30 days'
where clinic_id = current_setting('vars.clinic')::uuid;
select pg_temp.login('00000000-0000-4000-8000-0000000013a1');
select lives_ok(
  $$select public.create_clinic_service(current_setting('vars.clinic')::uuid,
      'Estética', 'grooming', 40::smallint, 25000)$$,
  'vigencia 9: al reactivar la suscripción, las escrituras regresan'
);

-- ----------------------------------------------------------------------------
-- Página de precios: catálogo activo visible para anon, beta ya no
-- ----------------------------------------------------------------------------
select pg_temp.logout();
select set_config('role', 'anon', true);
select results_eq(
  $$select code from public.plans where is_active order by code$$,
  $$values ('profesional'), ('profesional_anual')$$,
  'precios 1: anon ve exactamente los planes comerciales activos (beta ya no)'
);
select results_eq(
  $$select code, price_cents from public.list_public_plans() order by price_cents$$,
  $$values ('profesional', 59900), ('profesional_anual', 599000)$$,
  'precios 2: la RPC pública del catálogo devuelve los planes activos a anon'
);

select * from finish();
rollback;
