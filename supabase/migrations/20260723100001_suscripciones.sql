-- ============================================================================
-- Fase 11 — Preparación de suscripciones (sin cobro en MVP)
-- ============================================================================
-- Modelo comercial (PRD §7.4, DATABASE_DESIGN §3.7): suscripción POR CLÍNICA a
-- un plan, con una cantidad de veterinarios activos incluida y cobro futuro por
-- excedente. En el MVP toda clínica recibe automáticamente el plan `beta`
-- (gratuito, sin Stripe). El sistema PUEDE restringir por plan (funciones de
-- límite), pero `beta` es holgado y no bloquea. El cobro real (Stripe) llega en
-- una fase posterior; aquí solo se preparan el esquema y los ganchos.
-- ============================================================================

create type public.billing_interval as enum ('month', 'year');
create type public.plan_scope as enum ('clinic', 'organization');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- ----------------------------------------------------------------------------
-- Catálogo de planes
-- ----------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  billing_interval public.billing_interval not null default 'month',
  -- Veterinarios activos incluidos en el plan; el excedente se cobrará después.
  included_veterinarians integer not null check (included_veterinarians >= 0),
  additional_veterinarian_price_cents integer
    check (additional_veterinarian_price_cents is null or additional_veterinarian_price_cents >= 0),
  scope public.plan_scope not null default 'clinic',
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is
  'Catálogo de planes comerciales. Lectura pública (precios); escritura solo backend/superadmin.';

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
alter table public.plans force row level security;

-- Los planes activos son de lectura pública (página de precios futura). Se
-- separa la política pública de la de superadmin para que `anon` nunca evalúe
-- current_user_is_superadmin() (no tiene permiso de ejecución sobre esa función).
create policy plans_select_activos on public.plans
  for select to anon, authenticated using (is_active);
create policy plans_select_superadmin on public.plans
  for select to authenticated using (public.current_user_is_superadmin());

grant select on table public.plans to anon, authenticated;
grant all on table public.plans to service_role;

-- Plan beta del MVP: gratuito y holgado (no bloquea el alta de veterinarios).
insert into public.plans (code, name, price_cents, billing_interval, included_veterinarians,
                          additional_veterinarian_price_cents, scope, features)
values (
  'beta', 'Beta (gratuito)', 0, 'month', 999, null, 'clinic',
  jsonb_build_object('agenda', true, 'expediente', true, 'recetas', true,
                     'vacunacion', true, 'portal_publico', true, 'recordatorios', true)
);

-- ----------------------------------------------------------------------------
-- Suscripciones por clínica
-- ----------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics (id) on delete cascade,
  -- Denormalizado para reporteo/facturación de grupo (planes multi-sucursal futuros).
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status public.subscription_status not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  -- Identificadores de Stripe (nulos en el MVP; se llenan al activar el cobro).
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_periodo_valido
    check (current_period_end is null or current_period_end > current_period_start)
);

comment on table public.subscriptions is
  'Suscripción 1:1 por clínica. Alta automática al plan beta; cambios solo backend/superadmin.';

create index subscriptions_organization_idx on public.subscriptions (organization_id);
create index subscriptions_plan_idx on public.subscriptions (plan_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger subscriptions_audit
  after insert or update or delete on public.subscriptions
  for each row execute function public.audit_row_change();

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

-- Lectura: personal operativo de la clínica, admin de la organización o superadmin.
create policy subscriptions_select on public.subscriptions
  for select to authenticated using (
    public.is_clinic_operational_staff(clinic_id)
    or public.is_organization_admin(organization_id)
    or public.current_user_is_superadmin()
  );

-- Sin políticas de escritura para clientes: las suscripciones las gestionan el
-- alta automática (trigger), el webhook de Stripe (service_role) y el superadmin.
grant select on table public.subscriptions to authenticated;
grant all on table public.subscriptions to service_role;

-- ----------------------------------------------------------------------------
-- Alta automática al plan beta cuando se crea una clínica
-- ----------------------------------------------------------------------------
create or replace function public.assign_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  select id into v_plan from public.plans where code = 'beta';
  if v_plan is null then
    raise exception 'PLAN_BETA_INEXISTENTE: no se puede crear la suscripción por defecto.';
  end if;
  insert into public.subscriptions (clinic_id, organization_id, plan_id, status)
  values (new.id, new.organization_id, v_plan, 'active')
  on conflict (clinic_id) do nothing;
  return new;
end;
$$;

revoke all on function public.assign_default_subscription() from public, anon, authenticated;

create trigger clinics_assign_default_subscription
  after insert on public.clinics
  for each row execute function public.assign_default_subscription();

-- Toda clínica ya existente recibe su suscripción beta (idempotente).
insert into public.subscriptions (clinic_id, organization_id, plan_id, status)
select c.id, c.organization_id, (select id from public.plans where code = 'beta'), 'active'
from public.clinics c
where not exists (select 1 from public.subscriptions s where s.clinic_id = c.id)
on conflict (clinic_id) do nothing;

-- ----------------------------------------------------------------------------
-- Restricción por plan (el sistema PUEDE restringir; beta no bloquea)
-- ----------------------------------------------------------------------------
-- Plan vigente de una clínica (para UI y gating).
create or replace function public.clinic_current_plan(p_clinic_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'plan_code', p.code,
    'plan_name', p.name,
    'status', s.status,
    'included_veterinarians', p.included_veterinarians,
    'price_cents', p.price_cents,
    'features', p.features
  )
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.clinic_id = p_clinic_id;
$$;

create or replace function public.clinic_active_veterinarian_count(p_clinic_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.clinic_members
  where clinic_id = p_clinic_id and role = 'veterinarian' and status = 'active';
$$;

-- ¿La clínica está dentro del límite de veterinarios de su plan?
-- Sin suscripción se considera dentro del límite (defensa: no romper el alta).
create or replace function public.clinic_within_veterinarian_limit(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.clinic_active_veterinarian_count(p_clinic_id) <= p.included_veterinarians
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      where s.clinic_id = p_clinic_id
    ),
    true
  );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'clinic_current_plan(uuid)',
    'clinic_active_veterinarian_count(uuid)',
    'clinic_within_veterinarian_limit(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;
