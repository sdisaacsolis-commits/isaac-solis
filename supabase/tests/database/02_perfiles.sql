-- ============================================================================
-- pgTAP 02 — Perfiles: alta automática, visibilidad y protección de superadmin
-- ============================================================================
begin;
set search_path = public, extensions;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- Utilidades de suplantación de sesión (solo pruebas) -------------------------
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
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000f001', 'super@dogtoralia.mx', '{}'),
  ('00000000-0000-4000-8000-00000000a001', 'duena.a@ejemplo.mx', '{"full_name": "Ana Aguilar"}'),
  ('00000000-0000-4000-8000-00000000c001', 'nadie@ejemplo.mx', '{}');

update public.profiles set is_superadmin = true
where id = '00000000-0000-4000-8000-00000000f001';

-- Alta automática -------------------------------------------------------------
select is(
  (select count(*)::int from public.profiles),
  3,
  'se crea un perfil automáticamente por cada usuario de auth.users'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000a001'),
  'Ana Aguilar',
  'display_name se toma de los metadatos públicos del registro'
);

-- Visibilidad -----------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select is(
  (select count(*)::int from public.profiles),
  1,
  'un usuario normal solo ve su propio perfil'
);

select lives_ok(
  $$update public.profiles set display_name = 'Ana A.'
    where id = '00000000-0000-4000-8000-00000000a001'$$,
  'un usuario puede actualizar su propio perfil'
);
select is(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000a001'),
  'Ana A.',
  'la actualización del propio perfil surte efecto'
);

-- Intento de modificar el perfil de otra persona: RLS filtra (0 filas)
update public.profiles set display_name = 'hackeado'
where id = '00000000-0000-4000-8000-00000000c001';
select pg_temp.logout();
select is(
  (select display_name from public.profiles where id = '00000000-0000-4000-8000-00000000c001'),
  null,
  'el perfil de otra persona queda intacto'
);

-- Elevación de privilegios ----------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select throws_ok(
  $$update public.profiles set is_superadmin = true
    where id = '00000000-0000-4000-8000-00000000a001'$$,
  '42501',
  null,
  'caso 7: un usuario no puede hacerse superadministrador (privilegio de columna)'
);
select throws_ok(
  $$insert into public.profiles (id) values ('00000000-0000-4000-8000-00000000c001')$$,
  '42501',
  null,
  'un usuario no puede insertar perfiles directamente'
);
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-4000-8000-00000000a001'$$,
  '42501',
  null,
  'un usuario no puede borrar perfiles'
);

-- Superadmin ------------------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000f001');
select is(
  (select count(*)::int from public.profiles),
  3,
  'caso 12: el superadmin consulta perfiles mediante política explícita'
);

-- El cambio de is_superadmin hecho por backend quedó auditado ----------------
select pg_temp.logout();
select is(
  (select count(*)::int from public.audit_log
   where action = 'superadmin_change'
     and entity_id = '00000000-0000-4000-8000-00000000f001'),
  1,
  'el cambio de is_superadmin queda registrado en audit_log'
);

select * from finish();
rollback;
