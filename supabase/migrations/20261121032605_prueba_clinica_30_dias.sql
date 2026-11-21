-- New clinics only. Existing subscriptions, booking, access and clinical data are unchanged.
-- This migration does not enable billing or enforce capacity limits.
insert into public.plans (
  code, name, price_cents, billing_interval, included_veterinarians, scope, features
)
select 'trial_30d', 'Prueba gratis de 30 días', 0, 'month', included_veterinarians, 'clinic', features
from public.plans where code = 'beta';

create or replace function public.assign_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
begin
  select id into v_plan from public.plans where code = 'trial_30d';
  if v_plan is null then
    raise exception 'PLAN_PRUEBA_INEXISTENTE: no se puede crear la suscripción por defecto.';
  end if;
  insert into public.subscriptions (
    clinic_id, organization_id, plan_id, status, current_period_start, current_period_end
  )
  values (new.id, new.organization_id, v_plan, 'trialing', now(), now() + interval '720 hours')
  on conflict (clinic_id) do nothing;
  return new;
end;
$$;

comment on table public.subscriptions is
  'Suscripción 1:1 por clínica. Alta de nuevas clínicas con prueba de 30 días; beta se conserva. Política de lectura por clínica.';

-- Existing function signature remains compatible. Use the subscriptions table's RLS
-- rather than admitting any authenticated caller with a clinic UUID.
create or replace function public.clinic_current_plan(p_clinic_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'plan_code', p.code,
    'plan_name', p.name,
    'status', s.status,
    'included_veterinarians', p.included_veterinarians,
    'price_cents', p.price_cents,
    'features', p.features,
    'current_period_end', s.current_period_end
  )
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.clinic_id = p_clinic_id;
$$;

-- These legacy helpers run counts with definer privileges. Match the subscription
-- read policy before touching clinic membership, or return NULL without details.
create or replace function public.clinic_active_veterinarian_count(p_clinic_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1 from public.clinics c
    where c.id = p_clinic_id
      and (public.is_clinic_operational_staff(c.id)
        or public.is_organization_admin(c.organization_id)
        or public.current_user_is_superadmin()
        or current_setting('role', true) = 'service_role')
  ) then (
    select count(*)::int from public.clinic_members
    where clinic_id = p_clinic_id and role = 'veterinarian' and status = 'active'
  ) end;
$$;

create or replace function public.clinic_within_veterinarian_limit(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when v.total is not null then coalesce((
    select v.total <= p.included_veterinarians
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.clinic_id = p_clinic_id
  ), true) end
  from (select public.clinic_active_veterinarian_count(p_clinic_id) as total) v;
$$;

revoke all on function public.assign_default_subscription() from public, anon, authenticated;
revoke all on function public.clinic_current_plan(uuid), public.clinic_active_veterinarian_count(uuid),
  public.clinic_within_veterinarian_limit(uuid) from public, anon;
grant execute on function public.clinic_current_plan(uuid), public.clinic_active_veterinarian_count(uuid),
  public.clinic_within_veterinarian_limit(uuid) to authenticated, service_role;
