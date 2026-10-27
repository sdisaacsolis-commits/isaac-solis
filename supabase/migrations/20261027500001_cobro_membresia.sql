-- ============================================================================
-- Fase 13 — Cobro de membresía (activación comercial)
-- ============================================================================
-- Decisiones de producto (27-oct-2026, aprobadas por el propietario):
--  · Plan «Profesional»: $599 MXN/mes + IVA por clínica con 1 veterinario
--    incluido, +$399/mes por veterinario adicional. Anual: $5,990 (≈2 meses
--    gratis; el veterinario adicional anual sigue la misma regla: $3,990).
--    Referencia: <50% del plan Starter de Doctoralia MX ($1,230/mes/profesional).
--  · Clínicas nuevas: prueba de 14 días sin tarjeta (status `trialing`).
--  · Clínicas beta existentes: 60 días de gracia y migran al plan Profesional.
--  · Al vencer (sin pago): la clínica queda en SOLO LECTURA — los datos
--    clínicos jamás se tocan ni se borran (CLAUDE.md §6); solo se bloquean
--    las escrituras operativas. La restricción vive en la BD (CLAUDE.md §4).
-- El cobro real lo orquesta Stripe (Checkout + webhook `stripe-webhook` con
-- service_role); este esquema no guarda datos de tarjetas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Planes comerciales (el catálogo activo es público: página de precios)
-- ----------------------------------------------------------------------------
insert into public.plans
  (code, name, price_cents, billing_interval, included_veterinarians,
   additional_veterinarian_price_cents, scope, features)
values
  (
    'profesional', 'Profesional', 59900, 'month', 1, 39900, 'clinic',
    jsonb_build_object('agenda', true, 'expediente', true, 'recetas', true,
                       'vacunacion', true, 'portal_publico', true, 'recordatorios', true)
  ),
  (
    'profesional_anual', 'Profesional (anual)', 599000, 'year', 1, 399000, 'clinic',
    jsonb_build_object('agenda', true, 'expediente', true, 'recetas', true,
                       'vacunacion', true, 'portal_publico', true, 'recordatorios', true)
  );

-- El plan beta deja de ofrecerse a clínicas nuevas; las suscripciones beta
-- existentes lo conservan durante su periodo de gracia.
update public.plans set is_active = false where code = 'beta';

-- ----------------------------------------------------------------------------
-- 2) Gracia de 60 días para las clínicas que ya estaban en beta
-- ----------------------------------------------------------------------------
update public.subscriptions s
set current_period_end = now() + interval '60 days'
from public.plans p
where p.id = s.plan_id
  and p.code = 'beta'
  and s.current_period_end is null;

-- ----------------------------------------------------------------------------
-- 3) Alta por defecto de clínicas nuevas: prueba de 14 días del plan Profesional
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
  select id into v_plan from public.plans where code = 'profesional';
  if v_plan is null then
    raise exception 'PLAN_PROFESIONAL_INEXISTENTE: no se puede crear la suscripción por defecto.';
  end if;
  insert into public.subscriptions
    (clinic_id, organization_id, plan_id, status, current_period_start, current_period_end)
  values (new.id, new.organization_id, v_plan, 'trialing', now(), now() + interval '14 days')
  on conflict (clinic_id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4) Vigencia de la suscripción de una clínica
-- ----------------------------------------------------------------------------
-- Vigente ⇔ (trialing|active y el periodo no venció) o (past_due con hasta
-- 7 días de tolerancia tras el fin del periodo, mientras Stripe reintenta el
-- cobro). Sin fila de suscripción NO es vigente: toda clínica recibe la suya
-- por trigger desde la Fase 11, así que una ausencia es una anomalía.
create or replace function public.clinic_subscription_is_current(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        (s.status in ('trialing', 'active')
          and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'past_due'
          and coalesce(s.current_period_end, now()) > now() - interval '7 days')
      from public.subscriptions s
      where s.clinic_id = p_clinic_id
    ),
    false
  );
$$;

revoke all on function public.clinic_subscription_is_current(uuid) from public, anon;
grant execute on function public.clinic_subscription_is_current(uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5) Solo lectura al vencer: bloqueo de escrituras operativas en la BD
-- ----------------------------------------------------------------------------
-- El trigger corre con la sesión del usuario (auth.uid() presente). Los flujos
-- de backend (service_role, cron, webhook) no llevan uid y NO se bloquean: el
-- sistema sigue pudiendo corregir estados y procesar la facturación.
create or replace function public.enforce_active_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic uuid;
begin
  -- Backend/servicio (sin usuario autenticado): nunca se bloquea.
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;

  v_clinic := case when tg_op = 'DELETE' then old.clinic_id else new.clinic_id end;
  if v_clinic is null or public.clinic_subscription_is_current(v_clinic) then
    return coalesce(new, old);
  end if;

  raise exception
    'SUSCRIPCION_VENCIDA: la membresía de la clínica no está activa; el panel queda en solo lectura hasta reactivarla.'
    using errcode = '42501';
end;
$$;

revoke all on function public.enforce_active_subscription() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5b) Catálogo público de precios (página /precios)
-- ----------------------------------------------------------------------------
-- Las rutas públicas del sitio solo consumen RPCs curadas (regla del proyecto):
-- esta expone únicamente los campos comerciales de los planes activos.
create or replace function public.list_public_plans()
returns table (
  code text,
  name text,
  price_cents integer,
  billing_interval text,
  included_veterinarians integer,
  additional_veterinarian_price_cents integer,
  features jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.code, p.name, p.price_cents, p.billing_interval::text,
         p.included_veterinarians, p.additional_veterinarian_price_cents, p.features
  from public.plans p
  where p.is_active
  order by p.price_cents;
$$;

revoke all on function public.list_public_plans() from public;
grant execute on function public.list_public_plans() to anon, authenticated;

-- Variante para tablas HIJAS sin clinic_id propio: resuelven la clínica a
-- través de su tabla padre (TG_ARGV = tabla padre, columna FK). Misma regla:
-- backend sin uid nunca se bloquea.
create or replace function public.enforce_active_subscription_via()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_padre text := tg_argv[0];
  v_fk text := tg_argv[1];
  v_fk_valor uuid;
  v_clinic uuid;
begin
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;

  execute format('select ($1).%I::uuid', v_fk)
    into v_fk_valor
    using case when tg_op = 'DELETE' then old else new end;
  if v_fk_valor is null then
    return coalesce(new, old);
  end if;

  execute format('select clinic_id from public.%I where id = $1', v_padre)
    into v_clinic
    using v_fk_valor;
  if v_clinic is null or public.clinic_subscription_is_current(v_clinic) then
    return coalesce(new, old);
  end if;

  raise exception
    'SUSCRIPCION_VENCIDA: la membresía de la clínica no está activa; el panel queda en solo lectura hasta reactivarla.'
    using errcode = '42501';
end;
$$;

revoke all on function public.enforce_active_subscription_via() from public, anon, authenticated;

-- Tablas OPERATIVAS donde escribe la gente (panel/portal). Quedan fuera a
-- propósito: clinics y clinic_members (administrar el equipo y renovar sigue
-- permitido), subscriptions/plans (los gestiona el backend de cobro),
-- reviews/moderación (contenido del propietario, confianza del marketplace),
-- pets/pet_owners/pet_owner_relationships y vaccines_catalog (entidades
-- compartidas entre clínicas: el expediente del paciente no pertenece a una
-- sola clínica y otra clínica vigente puede atenderlo), contadores de folio,
-- historiales append-only, outbox de notificaciones y documentos congelados
-- (solo los escribe el sistema dentro de flujos ya bloqueados aguas arriba),
-- y audit_log. El DO valida columnas contra information_schema para fallar en
-- voz alta si la lista divergiera del esquema.
do $$
declare
  t text;
  hija text[];
  tablas constant text[] := array[
    'appointments', 'clinical_encounters', 'clinical_files', 'prescriptions',
    'pet_alerts', 'owner_clinic_relationships', 'clinic_pet_relationships',
    'owner_consents', 'clinic_services', 'veterinarian_schedules',
    'schedule_exceptions', 'clinic_invitations', 'portal_invitations',
    'vaccination_records', 'public_booking_requests'
  ];
  -- {tabla hija, tabla padre, columna FK hacia el padre}
  hijas constant text[][] := array[
    array['appointment_services', 'appointments', 'appointment_id'],
    array['clinical_notes', 'clinical_encounters', 'encounter_id'],
    array['clinical_vitals', 'clinical_encounters', 'encounter_id'],
    array['diagnoses', 'clinical_encounters', 'encounter_id'],
    array['encounter_examinations', 'clinical_encounters', 'encounter_id'],
    array['encounter_treatments', 'clinical_encounters', 'encounter_id'],
    array['encounter_follow_ups', 'clinical_encounters', 'encounter_id'],
    array['encounter_addenda', 'clinical_encounters', 'encounter_id'],
    array['prescription_items', 'prescriptions', 'prescription_id'],
    array['clinic_service_veterinarians', 'clinic_services', 'clinic_service_id']
  ];
begin
  foreach t in array tablas loop
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = t and c.column_name = 'clinic_id'
    ) then
      raise exception 'ENFORCEMENT_INVALIDO: la tabla %.clinic_id no existe', t;
    end if;
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function public.enforce_active_subscription()',
      t || '_requiere_suscripcion', t
    );
  end loop;

  foreach hija slice 1 in array hijas loop
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = hija[1] and c.column_name = hija[3]
    ) or not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = hija[2] and c.column_name = 'clinic_id'
    ) then
      raise exception 'ENFORCEMENT_INVALIDO: la relación %.% → %.clinic_id no existe',
        hija[1], hija[3], hija[2];
    end if;
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function public.enforce_active_subscription_via(%L, %L)',
      hija[1] || '_requiere_suscripcion', hija[1], hija[2], hija[3]
    );
  end loop;
end;
$$;
