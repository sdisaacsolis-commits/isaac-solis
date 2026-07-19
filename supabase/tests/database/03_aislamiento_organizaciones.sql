-- ============================================================================
-- pgTAP 03 — Organizaciones: creación, aislamiento y control de roles
-- ============================================================================
begin;
set search_path = public, extensions;
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
  ('00000000-0000-4000-8000-00000000a002', 'admin.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a007', 'extra.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c001', 'nadie@ejemplo.mx');

-- Creación por RPC ------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.org_a',
  public.create_organization_with_owner('Veterinaria Luna', 'veterinaria-luna')::text, true);
select isnt(current_setting('vars.org_a'), '', 'la RPC crea la organización y devuelve su id');
select is(
  (select count(*)::int from public.organizations),
  1,
  'el owner ve su organización'
);
select is(
  (select count(*)::int from public.organization_members
   where organization_id = current_setting('vars.org_a')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a001'
     and role = 'owner' and status = 'active'),
  1,
  'la RPC crea la membresía owner activa en la misma transacción'
);

select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.org_b',
  public.create_organization_with_owner('Veterinaria Sol')::text, true);

-- Aislamiento (caso 8) --------------------------------------------------------
select is(
  (select count(*)::int from public.organizations
   where id = current_setting('vars.org_a')::uuid),
  0,
  'caso 8: la organización B no puede leer la organización A'
);
select is(
  (select count(*)::int from public.organization_members
   where organization_id = current_setting('vars.org_a')::uuid),
  0,
  'caso 8: la organización B no puede leer miembros de la organización A'
);

select pg_temp.login('00000000-0000-4000-8000-00000000c001');
select is(
  (select count(*)::int from public.organizations),
  0,
  'un usuario sin membresías no ve ninguna organización'
);
select is(
  (select count(*)::int from public.organization_members),
  0,
  'un usuario sin membresías no ve membresía alguna'
);

-- Actualización ---------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select lives_ok(
  $$update public.organizations set name = 'Veterinaria Luna MX'
    where id = current_setting('vars.org_a')::uuid$$,
  'el owner actualiza los datos de su organización'
);

select pg_temp.login('00000000-0000-4000-8000-00000000b001');
update public.organizations set name = 'hackeada'
where id = current_setting('vars.org_a')::uuid; -- RLS filtra: 0 filas
select pg_temp.logout();
select is(
  (select name from public.organizations where id = current_setting('vars.org_a')::uuid),
  'Veterinaria Luna MX',
  'otro owner no puede modificar una organización ajena'
);

-- Gestión de membresías y elevación de privilegios ---------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select lives_ok(
  $$insert into public.organization_members
      (organization_id, user_id, role, status, joined_at, created_by)
    values (current_setting('vars.org_a')::uuid, '00000000-0000-4000-8000-00000000a002',
            'admin', 'active', now(), '00000000-0000-4000-8000-00000000a001')$$,
  'el owner agrega un admin a su organización'
);
select throws_ok(
  $$insert into public.organization_members
      (organization_id, user_id, role, status, joined_at, created_by)
    values (current_setting('vars.org_a')::uuid, '00000000-0000-4000-8000-00000000a002',
            'admin', 'active', now(), '00000000-0000-4000-8000-00000000a001')$$,
  '23505',
  null,
  'no se permiten membresías vivas duplicadas'
);

select pg_temp.login('00000000-0000-4000-8000-00000000a002');
select throws_ok(
  $$insert into public.organization_members
      (organization_id, user_id, role, status, joined_at, created_by)
    values (current_setting('vars.org_a')::uuid, '00000000-0000-4000-8000-00000000a007',
            'owner', 'active', now(), '00000000-0000-4000-8000-00000000a002')$$,
  '42501',
  null,
  'un admin no puede crear owners (no eleva por encima de su nivel)'
);
select lives_ok(
  $$insert into public.organization_members
      (organization_id, user_id, role, status, joined_at, created_by)
    values (current_setting('vars.org_a')::uuid, '00000000-0000-4000-8000-00000000a007',
            'member', 'active', now(), '00000000-0000-4000-8000-00000000a002')$$,
  'un admin agrega miembros de nivel igual o inferior'
);
select throws_ok(
  $$update public.organization_members set role = 'owner'
    where organization_id = current_setting('vars.org_a')::uuid
      and user_id = '00000000-0000-4000-8000-00000000a002'$$,
  '42501',
  null,
  'un admin no puede autoelevarse a owner'
);

update public.organization_members set role = 'member'
where organization_id = current_setting('vars.org_a')::uuid
  and user_id = '00000000-0000-4000-8000-00000000a001'; -- fila de owner: RLS filtra
select pg_temp.logout();
select is(
  (select role::text from public.organization_members
   where organization_id = current_setting('vars.org_a')::uuid
     and user_id = '00000000-0000-4000-8000-00000000a001'),
  'owner',
  'un admin no puede tocar la fila del owner'
);

-- Último owner ---------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_like(
  $$update public.organization_members set role = 'member'
    where organization_id = current_setting('vars.org_a')::uuid
      and user_id = '00000000-0000-4000-8000-00000000a001'$$,
  '%ULTIMO_OWNER%',
  'no puede degradarse al último owner activo'
);
select throws_like(
  $$update public.organization_members set status = 'removed'
    where organization_id = current_setting('vars.org_a')::uuid
      and user_id = '00000000-0000-4000-8000-00000000a001'$$,
  '%ULTIMO_OWNER%',
  'no puede removerse al último owner activo'
);
select throws_ok(
  $$delete from public.organization_members
    where organization_id = current_setting('vars.org_a')::uuid$$,
  '42501',
  null,
  'los clientes no tienen DELETE sobre membresías'
);

-- Slugs -----------------------------------------------------------------------
select throws_like(
  $$select public.create_organization_with_owner('Prueba', 'admin')$$,
  '%SLUG_RESERVADO%',
  'los slugs reservados se rechazan'
);
select throws_like(
  $$select public.create_organization_with_owner('Prueba', 'ab')$$,
  '%SLUG_INVALIDO%',
  'los slugs inválidos se rechazan'
);
select throws_ok(
  $$select public.create_organization_with_owner('Prueba', 'veterinaria-luna')$$,
  '23505',
  null,
  'el slug de organización es único'
);
select set_config('vars.org_a2',
  public.create_organization_with_owner('Vet Norte', ' Vet-Norte ')::text, true);
select is(
  (select slug from public.organizations where id = current_setting('vars.org_a2')::uuid),
  'vet-norte',
  'el slug se normaliza a minúsculas y sin espacios'
);

-- Rol anónimo -----------------------------------------------------------------
select pg_temp.logout();
select set_config('role', 'anon', true);
select throws_ok(
  $$select count(*) from public.organizations$$,
  '42501',
  null,
  'el rol anónimo no tiene acceso alguno a organizations'
);
select set_config('role', 'none', true);

select * from finish();
rollback;
