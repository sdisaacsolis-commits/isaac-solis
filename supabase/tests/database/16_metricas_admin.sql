-- ============================================================================
-- pgTAP 16 — Fase 10: panel administrativo y métricas
-- ============================================================================
-- Verifica: métricas de citas de clínica CORRECTAS contra un dataset conocido y
-- AISLADAS entre clínicas; permiso de personal para métricas de clínica y de
-- superadmin para métricas de plataforma (no-autorizados denegados).
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

-- Inserta una cita directa con estado y horario controlados (dataset conocido).
create function pg_temp.cita(
  p_org uuid, p_clinic uuid, p_folio text, p_pet uuid, p_owner uuid, p_vet uuid,
  p_status public.appointment_status, p_start timestamptz
) returns void language plpgsql as $$
begin
  insert into public.appointments (
    organization_id, clinic_id, folio, pet_id, owner_id,
    veterinarian_clinic_member_id, status, scheduled_start, scheduled_end,
    occupies_from, occupies_until,
    cancelled_at, cancellation_reason
  ) values (
    p_org, p_clinic, p_folio, p_pet, p_owner, p_vet, p_status,
    p_start, p_start + interval '30 minutes', p_start, p_start + interval '30 minutes',
    case when p_status = 'cancelled' then p_start - interval '1 day' end,
    case when p_status = 'cancelled' then 'prueba' end
  );
end;
$$;

-- Fixtures --------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000aa01', 'admin.a@metricas.mx'),
  ('00000000-0000-4000-8000-00000000aa04', 'vet.a@metricas.mx'),
  ('00000000-0000-4000-8000-00000000bb01', 'admin.b@metricas.mx'),
  ('00000000-0000-4000-8000-00000000bb04', 'vet.b@metricas.mx'),
  ('00000000-0000-4000-8000-00000000cc01', 'super@metricas.mx');

-- Clínica A
select pg_temp.login('00000000-0000-4000-8000-00000000aa01');
select set_config('vars.orgA',
  public.create_organization_with_owner('Metrics Org A')::text, true);
select set_config('vars.clinicA', public.create_clinic_with_admin(
  current_setting('vars.orgA')::uuid, 'Metrics Clínica A')::text, true);
select pg_temp.logout();
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.orgA')::uuid, '00000000-0000-4000-8000-00000000aa04',
        'member', 'active', now(), '00000000-0000-4000-8000-00000000aa01');
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.clinicA')::uuid, '00000000-0000-4000-8000-00000000aa04',
        'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000aa01');
select set_config('vars.vetA',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinicA')::uuid
     and user_id = '00000000-0000-4000-8000-00000000aa04'), true);
select pg_temp.login('00000000-0000-4000-8000-00000000aa01');
select set_config('vars.ownerA', public.register_owner_with_clinic(
  current_setting('vars.clinicA')::uuid, 'Ana', 'A', 'ana@metricas.mx', '+525500000001')::text, true);
select set_config('vars.petA', public.register_pet_with_relationships(
  current_setting('vars.clinicA')::uuid, current_setting('vars.ownerA')::uuid, 'Kira', 'dog')::text, true);

-- Clínica B (organización distinta) para aislamiento y permisos.
select pg_temp.login('00000000-0000-4000-8000-00000000bb01');
select set_config('vars.orgB',
  public.create_organization_with_owner('Metrics Org B')::text, true);
select set_config('vars.clinicB', public.create_clinic_with_admin(
  current_setting('vars.orgB')::uuid, 'Metrics Clínica B')::text, true);
select pg_temp.logout();
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.orgB')::uuid, '00000000-0000-4000-8000-00000000bb04',
        'member', 'active', now(), '00000000-0000-4000-8000-00000000bb01');
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.clinicB')::uuid, '00000000-0000-4000-8000-00000000bb04',
        'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000bb01');
select set_config('vars.vetB',
  (select id::text from public.clinic_members
   where clinic_id = current_setting('vars.clinicB')::uuid
     and user_id = '00000000-0000-4000-8000-00000000bb04'), true);
select pg_temp.login('00000000-0000-4000-8000-00000000bb01');
select set_config('vars.ownerB', public.register_owner_with_clinic(
  current_setting('vars.clinicB')::uuid, 'Beto', 'B', 'beto@metricas.mx', '+525500000002')::text, true);
select set_config('vars.petB', public.register_pet_with_relationships(
  current_setting('vars.clinicB')::uuid, current_setting('vars.ownerB')::uuid, 'Lomo', 'cat')::text, true);

-- Dataset conocido (America/Mexico_City, UTC-6; horas UTC → fecha local) --------
select pg_temp.logout();
-- Clínica A, periodo 2027-05-10..12: 3 completed, 2 cancelled (05-10), 1 no_show
-- (05-11), 1 confirmed + 1 requested (05-12). total = 8.
select pg_temp.cita(current_setting('vars.orgA')::uuid, current_setting('vars.clinicA')::uuid,
  'CIT-2027-000001', current_setting('vars.petA')::uuid, current_setting('vars.ownerA')::uuid,
  current_setting('vars.vetA')::uuid, 'completed', '2027-05-10 15:00+00');
select pg_temp.cita(current_setting('vars.orgA')::uuid, current_setting('vars.clinicA')::uuid,
  'CIT-2027-000002', current_setting('vars.petA')::uuid, current_setting('vars.ownerA')::uuid,
  current_setting('vars.vetA')::uuid, 'completed', '2027-05-10 16:00+00');
select pg_temp.cita(current_setting('vars.orgA')::uuid, current_setting('vars.clinicA')::uuid,
  'CIT-2027-000003', current_setting('vars.petA')::uuid, current_setting('vars.ownerA')::uuid,
  current_setting('vars.vetA')::uuid, 'completed', '2027-05-10 17:00+00');
select pg_temp.cita(current_setting('vars.orgA')::uuid, current_setting('vars.clinicA')::uuid,
  'CIT-2027-000004', current_setting('vars.petA')::uuid, current_setting('vars.ownerA')::uuid,
  current_setting('vars.vetA')::uuid, 'cancelled', '2027-05-10 18:00+00');
select pg_temp.cita(current_setting('vars.orgA')::uuid, current_setting('vars.clinicA')::uuid,
  'CIT-2027-000005', current_setting('vars.petA')::uuid, current_setting('vars.ownerA')::uuid,
  current_setting('vars.vetA')::uuid, 'cancelled', '2027-05-10 19:00+00');
select pg_temp.cita(current_setting('vars.orgA')::uuid, current_setting('vars.clinicA')::uuid,
  'CIT-2027-000006', current_setting('vars.petA')::uuid, current_setting('vars.ownerA')::uuid,
  current_setting('vars.vetA')::uuid, 'no_show', '2027-05-11 15:00+00');
select pg_temp.cita(current_setting('vars.orgA')::uuid, current_setting('vars.clinicA')::uuid,
  'CIT-2027-000007', current_setting('vars.petA')::uuid, current_setting('vars.ownerA')::uuid,
  current_setting('vars.vetA')::uuid, 'confirmed', '2027-05-12 15:00+00');
select pg_temp.cita(current_setting('vars.orgA')::uuid, current_setting('vars.clinicA')::uuid,
  'CIT-2027-000008', current_setting('vars.petA')::uuid, current_setting('vars.ownerA')::uuid,
  current_setting('vars.vetA')::uuid, 'requested', '2027-05-12 16:00+00');
-- Clínica B: 5 completed el 05-10 (NO deben contar en A).
select pg_temp.cita(current_setting('vars.orgB')::uuid, current_setting('vars.clinicB')::uuid,
  'CIT-2027-000001', current_setting('vars.petB')::uuid, current_setting('vars.ownerB')::uuid,
  current_setting('vars.vetB')::uuid, 'completed', '2027-05-10 15:00+00');
select pg_temp.cita(current_setting('vars.orgB')::uuid, current_setting('vars.clinicB')::uuid,
  'CIT-2027-000002', current_setting('vars.petB')::uuid, current_setting('vars.ownerB')::uuid,
  current_setting('vars.vetB')::uuid, 'completed', '2027-05-10 16:00+00');
select pg_temp.cita(current_setting('vars.orgB')::uuid, current_setting('vars.clinicB')::uuid,
  'CIT-2027-000003', current_setting('vars.petB')::uuid, current_setting('vars.ownerB')::uuid,
  current_setting('vars.vetB')::uuid, 'completed', '2027-05-10 17:00+00');
select pg_temp.cita(current_setting('vars.orgB')::uuid, current_setting('vars.clinicB')::uuid,
  'CIT-2027-000004', current_setting('vars.petB')::uuid, current_setting('vars.ownerB')::uuid,
  current_setting('vars.vetB')::uuid, 'completed', '2027-05-10 18:00+00');
select pg_temp.cita(current_setting('vars.orgB')::uuid, current_setting('vars.clinicB')::uuid,
  'CIT-2027-000005', current_setting('vars.petB')::uuid, current_setting('vars.ownerB')::uuid,
  current_setting('vars.vetB')::uuid, 'completed', '2027-05-10 19:00+00');

-- ----------------------------------------------------------------------------
-- Métricas de clínica: correctas contra el dataset conocido
-- ----------------------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000aa01');
select set_config('vars.m', (public.clinic_appointment_metrics(
  current_setting('vars.clinicA')::uuid, '2027-05-10', '2027-05-12'))::text, true);

select is(
  (current_setting('vars.m')::jsonb ->> 'total_periodo')::int, 8,
  'métricas 1: total del periodo = 8 (solo clínica A)'
);
select is(
  (current_setting('vars.m')::jsonb ->> 'completadas')::int, 3,
  'métricas 2: completadas = 3'
);
select is(
  (current_setting('vars.m')::jsonb ->> 'canceladas')::int, 2,
  'métricas 3: canceladas = 2'
);
select is(
  (current_setting('vars.m')::jsonb ->> 'no_show')::int, 1,
  'métricas 4: no_show = 1'
);
select is(
  (current_setting('vars.m')::jsonb -> 'por_estado' ->> 'confirmed')::int, 1,
  'métricas 5: confirmadas = 1'
);
select is(
  (current_setting('vars.m')::jsonb ->> 'por_confirmar')::int, 1,
  'métricas 6: por_confirmar (requested + pending_confirmation) = 1'
);
select is(
  (current_setting('vars.m')::jsonb ->> 'hoy')::int, 0,
  'métricas 7: hoy = 0 (el dataset es futuro)'
);

-- Aislamiento: un periodo que solo cubre el 05-10 da 5 en A, NUNCA 10.
select is(
  ((public.clinic_appointment_metrics(
    current_setting('vars.clinicA')::uuid, '2027-05-10', '2027-05-10'))::jsonb
    ->> 'total_periodo')::int,
  5, 'métricas 8: el 05-10 la clínica A tiene 5 citas (las 5 de B no cuentan)'
);

-- Permiso: el admin de B no puede leer métricas de la clínica A.
select pg_temp.login('00000000-0000-4000-8000-00000000bb01');
select throws_ok(
  format($$select public.clinic_appointment_metrics(%L, '2027-05-10', '2027-05-12')$$,
         current_setting('vars.clinicA')),
  '42501', null,
  'métricas 9: personal ajeno NO consulta métricas de otra clínica'
);
select throws_ok(
  format($$select public.clinic_appointment_metrics(%L, '2027-05-12', '2027-05-10')$$,
         current_setting('vars.clinicB')),
  '22023', null,
  'métricas 10: rango invertido se rechaza'
);

-- ----------------------------------------------------------------------------
-- Métricas de plataforma: solo superadmin
-- ----------------------------------------------------------------------------
select throws_ok(
  $$select public.platform_overview()$$,
  '42501', null,
  'plataforma 1: un usuario normal NO consulta el panorama global'
);
select throws_ok(
  $$select public.platform_clinics(50, 0)$$,
  '42501', null,
  'plataforma 2: un usuario normal NO lista las clínicas de la plataforma'
);

-- Elevar a superadmin (contexto backend: auth.uid() null permite el flag).
select pg_temp.logout();
update public.profiles set is_superadmin = true
where id = '00000000-0000-4000-8000-00000000cc01';

select pg_temp.login('00000000-0000-4000-8000-00000000cc01');
select set_config('vars.po', (public.platform_overview())::text, true);
select cmp_ok(
  (current_setting('vars.po')::jsonb -> 'clinicas' ->> 'total')::int, '>=', 2,
  'plataforma 3: el superadmin ve al menos 2 clínicas'
);
select cmp_ok(
  (current_setting('vars.po')::jsonb -> 'citas' ->> 'total')::int, '>=', 13,
  'plataforma 4: el superadmin ve al menos las 13 citas del dataset'
);
select cmp_ok(
  (select count(*)::int from public.platform_clinics(50, 0)), '>=', 2,
  'plataforma 5: el superadmin lista las clínicas'
);
select cmp_ok(
  (select count(*)::int from public.platform_recent_activity(50)), '>=', 1,
  'plataforma 6: el superadmin ve actividad reciente (audit_log)'
);

select * from finish();
rollback;
