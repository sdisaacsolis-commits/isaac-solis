-- ============================================================================
-- Fase 10 — Panel administrativo y métricas
-- ============================================================================
-- Métricas AGREGADAS por RPC SECURITY DEFINER (la autorización vive en la base):
--  · Métricas de clínica: para el personal operativo de esa clínica.
--  · Métricas de plataforma: solo para superadmin (profiles.is_superadmin, ya
--    existente, vía current_user_is_superadmin()).
-- Sin tablas nuevas: se agregan las citas/clínicas/organizaciones existentes.
-- El bucketing por fecha usa la zona horaria de la clínica (timestamptz en UTC).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Métricas de una clínica (personal operativo)
-- ----------------------------------------------------------------------------
create or replace function public.clinic_appointment_metrics(
  p_clinic_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_result jsonb;
begin
  if not public.is_clinic_operational_staff(p_clinic_id) then
    raise exception 'PERMISO_DENEGADO: tu rol no consulta métricas de esta clínica.'
      using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'RANGO_INVALIDO: la fecha inicial no puede ser posterior a la final.'
      using errcode = '22023';
  end if;

  select timezone into v_tz from public.clinics where id = p_clinic_id;
  v_tz := coalesce(v_tz, 'America/Mexico_City');

  with periodo as (
    select a.status
    from public.appointments a
    where a.clinic_id = p_clinic_id
      and ((a.scheduled_start at time zone v_tz)::date) between p_from and p_to
  ),
  por_estado as (
    select
      count(*) filter (where status = 'requested')             as requested,
      count(*) filter (where status = 'pending_confirmation')  as pending_confirmation,
      count(*) filter (where status = 'confirmed')             as confirmed,
      count(*) filter (where status = 'checked_in')            as checked_in,
      count(*) filter (where status = 'in_progress')           as in_progress,
      count(*) filter (where status = 'completed')             as completed,
      count(*) filter (where status = 'cancelled')             as cancelled,
      count(*) filter (where status = 'no_show')               as no_show,
      count(*)                                                  as total
    from periodo
  )
  select jsonb_build_object(
    'rango', jsonb_build_object('desde', p_from, 'hasta', p_to),
    'total_periodo', pe.total,
    'por_estado', jsonb_build_object(
      'requested', pe.requested,
      'pending_confirmation', pe.pending_confirmation,
      'confirmed', pe.confirmed,
      'checked_in', pe.checked_in,
      'in_progress', pe.in_progress,
      'completed', pe.completed,
      'cancelled', pe.cancelled,
      'no_show', pe.no_show
    ),
    'completadas', pe.completed,
    'canceladas', pe.cancelled,
    'no_show', pe.no_show,
    -- Métricas de estado ACTUAL (no acotadas al periodo):
    'hoy', (
      select count(*) from public.appointments a
      where a.clinic_id = p_clinic_id
        and (a.scheduled_start at time zone v_tz)::date = (now() at time zone v_tz)::date
    ),
    'por_confirmar', (
      select count(*) from public.appointments a
      where a.clinic_id = p_clinic_id
        and a.status in ('requested', 'pending_confirmation')
    )
  )
  into v_result
  from por_estado pe;

  return v_result;
end;
$$;

revoke all on function public.clinic_appointment_metrics(uuid, date, date) from public, anon;
grant execute on function public.clinic_appointment_metrics(uuid, date, date)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Métricas globales de plataforma (solo superadmin)
-- ----------------------------------------------------------------------------
create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.current_user_is_superadmin() then
    raise exception 'PERMISO_DENEGADO: solo un superadministrador consulta la plataforma.'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'organizaciones', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'suspended', count(*) filter (where status = 'suspended'),
        'archived', count(*) filter (where status = 'archived')
      ) from public.organizations
    ),
    'clinicas', (
      select jsonb_build_object(
        'total', count(*) filter (where deleted_at is null),
        'trial', count(*) filter (where status = 'trial' and deleted_at is null),
        'active', count(*) filter (where status = 'active' and deleted_at is null),
        'past_due', count(*) filter (where status = 'past_due' and deleted_at is null),
        'suspended', count(*) filter (where status = 'suspended' and deleted_at is null),
        'cancelled', count(*) filter (where status = 'cancelled' and deleted_at is null),
        'archived', count(*) filter (where status = 'archived' and deleted_at is null)
      ) from public.clinics
    ),
    'veterinarios_activos', (
      select count(*) from public.clinic_members
      where role = 'veterinarian' and status = 'active'
    ),
    'propietarios', (select count(*) from public.pet_owners),
    'mascotas', (select count(*) from public.pets where deleted_at is null),
    'citas', (
      select jsonb_build_object(
        'total', count(*),
        'ultimos_30_dias', count(*) filter (where scheduled_start >= now() - interval '30 days'),
        'completadas', count(*) filter (where status = 'completed'),
        'canceladas', count(*) filter (where status = 'cancelled')
      ) from public.appointments
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.platform_overview() from public, anon;
grant execute on function public.platform_overview() to authenticated, service_role;

-- Listado de clínicas para el superadmin (con su organización y actividad).
create or replace function public.platform_clinics(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  clinic_id uuid,
  clinic_name text,
  clinic_status public.clinic_status,
  is_public boolean,
  organization_id uuid,
  organization_name text,
  organization_status public.organization_status,
  appointment_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_superadmin() then
    raise exception 'PERMISO_DENEGADO: solo un superadministrador consulta la plataforma.'
      using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'LIMITE_INVALIDO: entre 1 y 200.' using errcode = '22023';
  end if;

  return query
  select c.id, c.name, c.status, c.is_public,
         o.id, o.name, o.status,
         (select count(*) from public.appointments a where a.clinic_id = c.id),
         c.created_at
  from public.clinics c
  join public.organizations o on o.id = c.organization_id
  where c.deleted_at is null
  order by c.created_at desc
  limit p_limit offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.platform_clinics(integer, integer) from public, anon;
grant execute on function public.platform_clinics(integer, integer) to authenticated, service_role;

-- Actividad global reciente (audit_log) para el superadmin.
create or replace function public.platform_recent_activity(p_limit integer default 50)
returns table (
  id bigint,
  action text,
  entity_type text,
  entity_id uuid,
  organization_id uuid,
  actor_user_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_superadmin() then
    raise exception 'PERMISO_DENEGADO: solo un superadministrador consulta la plataforma.'
      using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'LIMITE_INVALIDO: entre 1 y 200.' using errcode = '22023';
  end if;

  return query
  select l.id, l.action, l.entity_type, l.entity_id,
         l.organization_id, l.actor_user_id, l.created_at
  from public.audit_log l
  order by l.created_at desc, l.id desc
  limit p_limit;
end;
$$;

revoke all on function public.platform_recent_activity(integer) from public, anon;
grant execute on function public.platform_recent_activity(integer) to authenticated, service_role;
