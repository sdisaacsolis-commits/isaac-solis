-- ============================================================================
-- pgTAP 20 — Fase 14: PayPal como segundo proveedor de pagos
-- ============================================================================
-- Verifica la generalización por proveedor en `subscriptions`: columnas nuevas,
-- dominio cerrado de `payment_provider`, unicidad del id de PayPal y que el
-- backend (webhook, sin uid) puede vincular una suscripción de PayPal.
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
  ('00000000-0000-4000-8000-0000000014a1', 'admin.a@paypal.mx'),
  ('00000000-0000-4000-8000-0000000014b1', 'admin.b@paypal.mx');

select pg_temp.login('00000000-0000-4000-8000-0000000014a1');
select set_config('vars.orgA', public.create_organization_with_owner('PayPal Org A')::text, true);
select set_config('vars.clinicA',
  public.create_clinic_with_admin(current_setting('vars.orgA')::uuid, 'PayPal Clínica A')::text, true);
select pg_temp.login('00000000-0000-4000-8000-0000000014b1');
select set_config('vars.orgB', public.create_organization_with_owner('PayPal Org B')::text, true);
select set_config('vars.clinicB',
  public.create_clinic_with_admin(current_setting('vars.orgB')::uuid, 'PayPal Clínica B')::text, true);
select pg_temp.logout();

-- ----------------------------------------------------------------------------
-- Esquema por proveedor
-- ----------------------------------------------------------------------------
select has_column('public', 'subscriptions', 'payment_provider',
  'paypal 1: subscriptions.payment_provider existe');
select has_column('public', 'subscriptions', 'paypal_subscription_id',
  'paypal 2: subscriptions.paypal_subscription_id existe');

-- El backend (webhook de PayPal, sin uid) vincula la suscripción de la clínica.
select lives_ok(
  $$update public.subscriptions
    set payment_provider = 'paypal', paypal_subscription_id = 'I-TEST0001',
        status = 'active', current_period_start = now(),
        current_period_end = now() + interval '30 days'
    where clinic_id = current_setting('vars.clinicA')::uuid$$,
  'paypal 3: el backend vincula proveedor e id de PayPal'
);
select is(
  (select payment_provider from public.subscriptions
   where clinic_id = current_setting('vars.clinicA')::uuid),
  'paypal', 'paypal 4: la suscripción queda etiquetada con su proveedor'
);

-- Dominio cerrado: ningún proveedor fuera de stripe|paypal.
select throws_ok(
  $$update public.subscriptions set payment_provider = 'mercadopago'
    where clinic_id = current_setting('vars.clinicB')::uuid$$,
  '23514', null,
  'paypal 5: payment_provider rechaza proveedores fuera del dominio'
);

-- Unicidad: un id de suscripción de PayPal no puede pertenecer a dos clínicas.
select throws_ok(
  $$update public.subscriptions
    set payment_provider = 'paypal', paypal_subscription_id = 'I-TEST0001'
    where clinic_id = current_setting('vars.clinicB')::uuid$$,
  '23505', null,
  'paypal 6: paypal_subscription_id es único entre clínicas'
);

select * from finish();
rollback;
