-- ============================================================================
-- pgTAP 04 — Clínicas: aislamiento entre clínicas, roles y ciclo de vida
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

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Fixtures --------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'duena.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a003', 'admin.clinica.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a004', 'vet.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a006', 'suspendida.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a007', 'extra.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b002', 'admin.clinica.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c001', 'nadie@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c005', 'sin.organizacion@ejemplo.mx');

-- Organización A con su personal
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.org_a',
  public.create_organization_with_owner('Veterinaria Luna')::text, true);
with c as (
  insert into public.clinics (organization_id, name, created_by)
  values (current_setting('vars.org_a')::uuid, 'Clínica Luna Centro',
          '00000000-0000-4000-8000-00000000a001')
  returning id
)
select set_config('vars.clinic_a1', (select id from c)::text, true);

insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
select current_setting('vars.org_a')::uuid, u.id, 'member', 'active', now(),
       '00000000-0000-4000-8000-00000000a001'
from (values ('00000000-0000-4000-8000-00000000a003'::uuid),
             ('00000000-0000-4000-8000-00000000a004'::uuid),
             ('00000000-0000-4000-8000-00000000a005'::uuid),
             ('00000000-0000-4000-8000-00000000a006'::uuid),
             ('00000000-0000-4000-8000-00000000a007'::uuid)) as u (id);

insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a003',
   'clinic_admin', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a004',
   'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a005',
   'receptionist', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a006',
   'assistant', 'active', now(), '00000000-0000-4000-8000-00000000a001');

-- Organización B con su clínica
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.org_b',
  public.create_organization_with_owner('Veterinaria Sol')::text, true);
with c as (
  insert into public.clinics (organization_id, name, created_by)
  values (current_setting('vars.org_b')::uuid, 'Clínica Sol Roma',
          '00000000-0000-4000-8000-00000000b001')
  returning id
)
select set_config('vars.clinic_b1', (select id from c)::text, true);
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.org_b')::uuid, '00000000-0000-4000-8000-00000000b002',
        'member', 'active', now(), '00000000-0000-4000-8000-00000000b001');
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.clinic_b1')::uuid, '00000000-0000-4000-8000-00000000b002',
        'clinic_admin', 'active', now(), '00000000-0000-4000-8000-00000000b001');

-- Caso 1: sin membresía no hay clínicas visibles ------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000c001');
select is((select count(*)::int from public.clinics), 0,
  'caso 1: un usuario sin membresías no ve ninguna clínica');

-- Caso 2: miembro de A no ve B ------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select is(
  (select count(*)::int from public.clinics where id = current_setting('vars.clinic_a1')::uuid),
  1, 'un veterinario ve su clínica');
select is(
  (select count(*)::int from public.clinics where id = current_setting('vars.clinic_b1')::uuid),
  0, 'caso 2: un miembro de la clínica A no puede ver la clínica B');
select is(
  (select count(*)::int from public.clinic_members
   where clinic_id = current_setting('vars.clinic_b1')::uuid),
  0, 'caso 2: tampoco ve membresías de la clínica B');

-- Caso 3: admin de organización ve sus clínicas sin membresía de clínica ------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select is(
  (select count(*)::int from public.clinics where id = current_setting('vars.clinic_a1')::uuid),
  1, 'caso 3: el owner de la organización ve sus clínicas sin ser miembro de ellas');

-- Caso 4: admin de clínica no modifica otra clínica ---------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
update public.clinics set name = 'hackeada'
where id = current_setting('vars.clinic_a1')::uuid; -- RLS filtra: 0 filas
select pg_temp.logout();
select is(
  (select name from public.clinics where id = current_setting('vars.clinic_a1')::uuid),
  'Clínica Luna Centro',
  'caso 4: el admin de la clínica B no puede modificar la clínica A'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a003');
select lives_ok(
  $$update public.clinics set name = 'Clínica Luna Centro Histórico'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  'el admin de clínica sí actualiza su propia clínica'
);
select throws_ok(
  $$update public.clinics set status = 'suspended'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  '42501',
  null,
  'el estado de la clínica no es modificable por clientes (privilegio de columna)'
);

-- Caso 5: recepcionista no cambia roles ---------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
update public.clinic_members set role = 'clinic_admin'
where clinic_id = current_setting('vars.clinic_a1')::uuid
  and user_id = '00000000-0000-4000-8000-00000000a005'; -- RLS filtra: 0 filas
-- El objetivo a007 SÍ es miembro activo de la organización: la denegación que
-- se prueba aquí es la de RLS (42501), no la del trigger de pertenencia.
select throws_ok(
  $$insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
    values (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000a007',
            'assistant', 'active', now(), '00000000-0000-4000-8000-00000000a005')$$,
  '42501',
  null,
  'caso 5: una recepcionista no puede crear membresías'
);
select pg_temp.logout();
select is(
  (select role::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a005'),
  'receptionist',
  'caso 5: una recepcionista no puede cambiar roles (ni el propio)'
);

-- Caso 6: veterinario no eleva su propio rol ----------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
update public.clinic_members set role = 'clinic_admin'
where clinic_id = current_setting('vars.clinic_a1')::uuid
  and user_id = '00000000-0000-4000-8000-00000000a004'; -- RLS filtra: 0 filas
select pg_temp.logout();
select is(
  (select role::text from public.clinic_members
   where clinic_id = current_setting('vars.clinic_a1')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a004'),
  'veterinarian',
  'caso 6: un veterinario no puede elevar su propio rol'
);

-- El admin de clínica sí administra membresías de SU clínica ------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a003');
select lives_ok(
  $$update public.clinic_members set job_title = 'Médico responsable'
    where clinic_id = current_setting('vars.clinic_a1')::uuid
      and user_id = '00000000-0000-4000-8000-00000000a004'$$,
  'el admin de clínica administra membresías de su clínica'
);
-- El objetivo b002 es miembro activo de la organización B: la denegación que
-- se prueba es la de RLS (el actor no es admin de B), no la del trigger.
select throws_ok(
  $$insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
    values (current_setting('vars.clinic_b1')::uuid, '00000000-0000-4000-8000-00000000b002',
            'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a003')$$,
  '42501',
  null,
  'el admin de la clínica A no puede crear membresías en la clínica B'
);

-- Pertenencia previa a la organización ----------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_like(
  $$insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
    values (current_setting('vars.clinic_a1')::uuid, '00000000-0000-4000-8000-00000000c005',
            'assistant', 'active', now(), '00000000-0000-4000-8000-00000000a001')$$,
  '%MIEMBRO_SIN_ORGANIZACION%',
  'nadie entra a una clínica sin ser miembro activo de la organización dueña'
);

-- Un veterinario no puede crear clínicas --------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_ok(
  $$insert into public.clinics (organization_id, name, created_by)
    values (current_setting('vars.org_a')::uuid, 'Clínica pirata',
            '00000000-0000-4000-8000-00000000a004')$$,
  '42501',
  null,
  'solo administradores de la organización crean clínicas'
);

-- Caso 9: membresía suspendida pierde acceso operativo ------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select lives_ok(
  $$update public.clinic_members set status = 'suspended'
    where clinic_id = current_setting('vars.clinic_a1')::uuid
      and user_id = '00000000-0000-4000-8000-00000000a006'$$,
  'un admin de la organización suspende una membresía'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a006');
select is((select count(*)::int from public.clinics), 0,
  'caso 9: una miembro suspendida deja de ver la clínica');
select is(
  (select count(*)::int from public.clinic_members
   where user_id = '00000000-0000-4000-8000-00000000a006'),
  1,
  'la miembro suspendida aún ve su propia membresía (y su estado)'
);

-- Slugs de clínica: reservados y unicidad GLOBAL ------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_like(
  $$update public.clinics set slug = 'clinicas'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  '%SLUG_RESERVADO%',
  'los slugs reservados también aplican a clínicas'
);
select lives_ok(
  $$update public.clinics set slug = 'sucursal-centro'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  'un admin asigna slug a su clínica'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select throws_ok(
  $$update public.clinics set slug = 'sucursal-centro'
    where id = current_setting('vars.clinic_b1')::uuid$$,
  '23505',
  null,
  'el slug de clínica es único GLOBALMENTE (rutas públicas /clinicas/[slug])'
);

-- Ciclo de vida de la clínica (máquina de estados, aplica también a backend) --
select pg_temp.logout();
select throws_like(
  $$update public.clinics set status = 'archived'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  '%TRANSICION_INVALIDA%',
  'trial no puede saltar a archived'
);
select lives_ok(
  $$update public.clinics set status = 'active'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  'trial → active es válida'
);
select lives_ok(
  $$update public.clinics set status = 'suspended'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  'active → suspended es válida'
);
select lives_ok(
  $$update public.clinics set status = 'active'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  'suspended → active (reactivación) es válida'
);
select throws_like(
  $$update public.clinics set status = 'trial'
    where id = current_setting('vars.clinic_a1')::uuid$$,
  '%TRANSICION_INVALIDA%',
  'no se regresa a trial'
);

-- Caso 10: borrado lógico oculta la clínica -----------------------------------
update public.clinics set deleted_at = now()
where id = current_setting('vars.clinic_b1')::uuid;
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select is(
  (select count(*)::int from public.clinics
   where id = current_setting('vars.clinic_b1')::uuid),
  0,
  'caso 10: una clínica con borrado lógico desaparece de las consultas normales'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from public.clinics),
  0,
  'caso 10: tampoco la ven sus miembros'
);

select * from finish();
rollback;
