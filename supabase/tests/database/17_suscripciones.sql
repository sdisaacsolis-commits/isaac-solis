-- ============================================================================
-- pgTAP 17 — Fase 11: preparación de suscripciones
-- ============================================================================
-- Verifica: toda clínica recibe automáticamente una suscripción al plan beta;
-- el plan vigente se consulta; el sistema PUEDE restringir por plan (límite de
-- veterinarios) aunque beta no bloquea; RLS de suscripciones (aislamiento entre
-- clínicas, superadmin ve todo, cliente no escribe); planes activos públicos.
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
  ('00000000-0000-4000-8000-0000000011a1', 'admin.a@subs.mx'),
  ('00000000-0000-4000-8000-0000000011a4', 'vet.a1@subs.mx'),
  ('00000000-0000-4000-8000-0000000011a5', 'vet.a2@subs.mx'),
  ('00000000-0000-4000-8000-0000000011b1', 'admin.b@subs.mx'),
  ('00000000-0000-4000-8000-0000000011b4', 'vet.b1@subs.mx'),
  ('00000000-0000-4000-8000-0000000011b5', 'vet.b2@subs.mx'),
  ('00000000-0000-4000-8000-0000000011c1', 'super@subs.mx');

select pg_temp.login('00000000-0000-4000-8000-0000000011a1');
select set_config('vars.orgA', public.create_organization_with_owner('Subs Org A')::text, true);
select set_config('vars.clinicA',
  public.create_clinic_with_admin(current_setting('vars.orgA')::uuid, 'Subs Clínica A')::text, true);
select pg_temp.login('00000000-0000-4000-8000-0000000011b1');
select set_config('vars.orgB', public.create_organization_with_owner('Subs Org B')::text, true);
select set_config('vars.clinicB',
  public.create_clinic_with_admin(current_setting('vars.orgB')::uuid, 'Subs Clínica B')::text, true);

-- Dos veterinarios activos en cada clínica (inserción directa de backend).
select pg_temp.logout();
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.orgA')::uuid, '00000000-0000-4000-8000-0000000011a4', 'member', 'active', now(), '00000000-0000-4000-8000-0000000011a1'),
  (current_setting('vars.orgA')::uuid, '00000000-0000-4000-8000-0000000011a5', 'member', 'active', now(), '00000000-0000-4000-8000-0000000011a1'),
  (current_setting('vars.orgB')::uuid, '00000000-0000-4000-8000-0000000011b4', 'member', 'active', now(), '00000000-0000-4000-8000-0000000011b1'),
  (current_setting('vars.orgB')::uuid, '00000000-0000-4000-8000-0000000011b5', 'member', 'active', now(), '00000000-0000-4000-8000-0000000011b1');
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.clinicA')::uuid, '00000000-0000-4000-8000-0000000011a4', 'veterinarian', 'active', now(), '00000000-0000-4000-8000-0000000011a1'),
  (current_setting('vars.clinicA')::uuid, '00000000-0000-4000-8000-0000000011a5', 'veterinarian', 'active', now(), '00000000-0000-4000-8000-0000000011a1'),
  (current_setting('vars.clinicB')::uuid, '00000000-0000-4000-8000-0000000011b4', 'veterinarian', 'active', now(), '00000000-0000-4000-8000-0000000011b1'),
  (current_setting('vars.clinicB')::uuid, '00000000-0000-4000-8000-0000000011b5', 'veterinarian', 'active', now(), '00000000-0000-4000-8000-0000000011b1');

-- ----------------------------------------------------------------------------
-- Alta automática y cobertura total
-- ----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.subscriptions
   where clinic_id = current_setting('vars.clinicA')::uuid), 1,
  'suscripciones 1: crear una clínica genera automáticamente su suscripción'
);
select is(
  (select p.code from public.subscriptions s join public.plans p on p.id = s.plan_id
   where s.clinic_id = current_setting('vars.clinicA')::uuid),
  'beta', 'suscripciones 2: el plan por defecto es beta'
);
select is(
  (select status::text from public.subscriptions
   where clinic_id = current_setting('vars.clinicA')::uuid),
  'active', 'suscripciones 3: la suscripción nace activa'
);
select is(
  (select count(*)::int from public.clinics c
   where c.deleted_at is null
     and not exists (select 1 from public.subscriptions s where s.clinic_id = c.id)),
  0, 'suscripciones 4: NINGUNA clínica queda sin suscripción (criterio de salida)'
);

-- ----------------------------------------------------------------------------
-- Plan vigente y restricción por plan (beta no bloquea)
-- ----------------------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-0000000011a1');
select is(
  (public.clinic_current_plan(current_setting('vars.clinicA')::uuid) ->> 'plan_code'),
  'beta', 'plan 1: clinic_current_plan devuelve el plan vigente'
);
select is(
  public.clinic_active_veterinarian_count(current_setting('vars.clinicA')::uuid), 2,
  'plan 2: cuenta los veterinarios activos'
);
select ok(
  public.clinic_within_veterinarian_limit(current_setting('vars.clinicA')::uuid),
  'plan 3: con 2 vets el plan beta (999 incluidos) NO bloquea'
);

-- El sistema PUEDE restringir: un plan restrictivo (1 incluido) sí marca exceso.
select pg_temp.logout();
insert into public.plans (code, name, price_cents, billing_interval, included_veterinarians, scope)
values ('solo_uno', 'Restrictivo (1 vet)', 50000, 'month', 1, 'clinic');
update public.subscriptions
set plan_id = (select id from public.plans where code = 'solo_uno')
where clinic_id = current_setting('vars.clinicB')::uuid;
select pg_temp.login('00000000-0000-4000-8000-0000000011b1');
select ok(
  not public.clinic_within_veterinarian_limit(current_setting('vars.clinicB')::uuid),
  'plan 4: con 2 vets y plan de 1 incluido, el sistema detecta el exceso (puede restringir)'
);

-- ----------------------------------------------------------------------------
-- RLS de suscripciones
-- ----------------------------------------------------------------------------
-- El personal ve la suscripción de SU clínica…
select pg_temp.login('00000000-0000-4000-8000-0000000011a1');
select is(
  (select count(*)::int from public.subscriptions
   where clinic_id = current_setting('vars.clinicA')::uuid), 1,
  'rls 1: el personal ve la suscripción de su clínica'
);
-- …pero NO la de otra clínica (aislamiento).
select is(
  (select count(*)::int from public.subscriptions
   where clinic_id = current_setting('vars.clinicB')::uuid), 0,
  'rls 2: el personal NO ve la suscripción de otra clínica'
);
-- Un cliente no puede escribir suscripciones (sin política de INSERT).
select throws_ok(
  format($$insert into public.subscriptions (clinic_id, organization_id, plan_id, status)
           values (%L, %L, (select id from public.plans where code = 'beta'), 'active')$$,
         '00000000-0000-4000-8000-0000000011ff', current_setting('vars.orgA')),
  '42501', null,
  'rls 3: un cliente autenticado NO puede insertar suscripciones'
);

-- El superadmin ve todas las suscripciones.
select pg_temp.logout();
update public.profiles set is_superadmin = true
where id = '00000000-0000-4000-8000-0000000011c1';
select pg_temp.login('00000000-0000-4000-8000-0000000011c1');
select cmp_ok(
  (select count(*)::int from public.subscriptions), '>=', 2,
  'rls 4: el superadmin ve todas las suscripciones'
);

-- ----------------------------------------------------------------------------
-- Planes públicos
-- ----------------------------------------------------------------------------
select pg_temp.logout();
select set_config('role', 'anon', true);
select ok(
  (select count(*) from public.plans where code = 'beta') = 1,
  'planes 1: los planes activos son de lectura pública (anon)'
);

select * from finish();
rollback;
