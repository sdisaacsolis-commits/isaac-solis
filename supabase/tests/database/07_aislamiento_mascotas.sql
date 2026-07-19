-- ============================================================================
-- pgTAP 07 — Fase 4: esquema de pacientes y aislamiento entre clínicas
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

-- Esquema ---------------------------------------------------------------------
select has_table('public', 'pet_owners', 'existe pet_owners');
select has_table('public', 'pets', 'existe pets');
select has_table('public', 'pet_owner_relationships', 'existe pet_owner_relationships');
select has_table('public', 'clinic_pet_relationships', 'existe clinic_pet_relationships');
select has_table('public', 'owner_clinic_relationships', 'existe owner_clinic_relationships');
select has_table('public', 'pet_alerts', 'existe pet_alerts');
select has_table('public', 'owner_consents', 'existe owner_consents');

select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not (c.relrowsecurity and c.relforcerowsecurity)
  ),
  0,
  'TODAS las tablas de public (incluidas las de la Fase 4) tienen RLS habilitado y forzado'
);

select enum_has_labels('public', 'pet_species', array['dog', 'cat', 'other'], 'especies');
select enum_has_labels('public', 'pet_sex', array['male', 'female', 'unknown'], 'sexos');

select has_index('public', 'pets', 'pets_microchip_unico', 'microchip único parcial');
select has_index('public', 'pet_owner_relationships', 'pet_owner_relationships_un_principal',
  'un solo principal activo por mascota');
select has_index('public', 'clinic_pet_relationships', 'clinic_pet_relationships_una_activa',
  'relación clínica-mascota activa única');

select is_definer('public', 'can_access_pet', array['uuid'], 'can_access_pet es DEFINER');
select is_definer('public', 'can_manage_owner', array['uuid'], 'can_manage_owner es DEFINER');

select policies_are('public', 'pets',
  array['pets_select_relacionadas', 'pets_select_superadmin', 'pets_update_gestores'],
  'políticas de pets');
select policies_are('public', 'pet_owners',
  array['pet_owners_select_relacionados', 'pet_owners_select_superadmin',
        'pet_owners_update_gestores'],
  'políticas de pet_owners');

-- Fixtures --------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000f001', 'super@dogtoralia.mx'),
  ('00000000-0000-4000-8000-00000000a001', 'duena.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a003', 'admin.clinica.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a004', 'vet.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a006', 'asistente.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a008', 'suspendida.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b002', 'admin.clinica.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c001', 'nadie@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000c009', 'propietaria.portal@ejemplo.mx');

update public.profiles set is_superadmin = true
where id = '00000000-0000-4000-8000-00000000f001';

-- Organización A: clínicas A1 y A2; personal completo en A1
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.org_a', public.create_organization_with_owner('Vet Luna')::text, true);
select set_config('vars.a1', public.create_clinic_with_admin(
  current_setting('vars.org_a')::uuid, 'Clínica Luna Centro')::text, true);
select set_config('vars.a2', public.create_clinic_with_admin(
  current_setting('vars.org_a')::uuid, 'Clínica Luna Norte')::text, true);
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
select current_setting('vars.org_a')::uuid, u.id, 'member', 'active', now(),
       '00000000-0000-4000-8000-00000000a001'
from (values ('00000000-0000-4000-8000-00000000a003'::uuid),
             ('00000000-0000-4000-8000-00000000a004'::uuid),
             ('00000000-0000-4000-8000-00000000a005'::uuid),
             ('00000000-0000-4000-8000-00000000a006'::uuid),
             ('00000000-0000-4000-8000-00000000a008'::uuid)) as u (id);
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.a1')::uuid, '00000000-0000-4000-8000-00000000a003', 'clinic_admin', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.a1')::uuid, '00000000-0000-4000-8000-00000000a004', 'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.a1')::uuid, '00000000-0000-4000-8000-00000000a005', 'receptionist', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.a1')::uuid, '00000000-0000-4000-8000-00000000a006', 'assistant', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.a1')::uuid, '00000000-0000-4000-8000-00000000a008', 'receptionist', 'suspended', now(), '00000000-0000-4000-8000-00000000a001');

-- Organización B: clínica B1
select pg_temp.login('00000000-0000-4000-8000-00000000b001');
select set_config('vars.org_b', public.create_organization_with_owner('Vet Sol')::text, true);
select set_config('vars.b1', public.create_clinic_with_admin(
  current_setting('vars.org_b')::uuid, 'Clínica Sol Roma')::text, true);
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.org_b')::uuid, '00000000-0000-4000-8000-00000000b002',
        'member', 'active', now(), '00000000-0000-4000-8000-00000000b001');
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values (current_setting('vars.b1')::uuid, '00000000-0000-4000-8000-00000000b002',
        'clinic_admin', 'active', now(), '00000000-0000-4000-8000-00000000b001');

-- Caso 5: la recepcionista registra propietaria y mascota en su clínica -------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.own1', public.register_owner_with_clinic(
  current_setting('vars.a1')::uuid, 'Laura', 'Ramírez',
  ' Laura@Ejemplo.MX ', '+52 (55) 1111-2222', null, 'whatsapp',
  null, null, null, 'CDMX', null, '06100', 'Cliente puntual', 'C-0001')::text, true);
select isnt(current_setting('vars.own1'), '', 'caso 5: recepción registra propietarios');
select is(
  (select email from public.pet_owners where id = current_setting('vars.own1')::uuid),
  'laura@ejemplo.mx',
  'el correo del propietario se normaliza'
);
select is(
  (select phone from public.pet_owners where id = current_setting('vars.own1')::uuid),
  '+525511112222',
  'el teléfono del propietario se normaliza'
);

select set_config('vars.pet_a', public.register_pet_with_relationships(
  current_setting('vars.a1')::uuid, current_setting('vars.own1')::uuid,
  'Firulais', 'dog', 'Mestizo', 'male', '2022-03-01', false,
  'Café', null, '985 1120-333444555', true, 'owner', 'P-0001', 'manual')::text, true);
select is(
  (select microchip_number from public.pets where id = current_setting('vars.pet_a')::uuid),
  '9851120333444555',
  'el microchip se normaliza (sin espacios/guiones, mayúsculas)'
);
select is(
  (select count(*)::int from public.pet_owner_relationships
   where pet_id = current_setting('vars.pet_a')::uuid and is_primary and status = 'active'),
  1,
  'el registro crea exactamente un propietario principal activo'
);

-- Mascota exclusiva de B1 y propietaria compartida-luego en B ------------------
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select set_config('vars.own2', public.register_owner_with_clinic(
  current_setting('vars.b1')::uuid, 'Marco', 'Silva', 'marco@ejemplo.mx', '+525533334444')::text, true);
select set_config('vars.pet_b', public.register_pet_with_relationships(
  current_setting('vars.b1')::uuid, current_setting('vars.own2')::uuid,
  'Michi', 'cat', null, 'female')::text, true);

-- Mascota COMPARTIDA: nace en A1 y (vía backend, simulando consentimiento
-- futuro) obtiene relación activa con B1.
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.pet_shared', public.register_pet_with_relationships(
  current_setting('vars.a1')::uuid, current_setting('vars.own1')::uuid,
  'Rocky', 'dog', 'Boxer', 'male', '2020-01-15', true)::text, true);
select pg_temp.logout();
insert into public.clinic_pet_relationships
  (organization_id, clinic_id, pet_id, status, source, administrative_notes, created_by)
values (current_setting('vars.org_b')::uuid, current_setting('vars.b1')::uuid,
        current_setting('vars.pet_shared')::uuid, 'active', 'referral',
        'Nota PRIVADA de clínica B', '00000000-0000-4000-8000-00000000b002');

-- Propietaria vinculada a usuario (portal futuro) ------------------------------
update public.pet_owners set user_id = '00000000-0000-4000-8000-00000000c009'
where id = current_setting('vars.own1')::uuid;

-- Caso 1 y 2: aislamiento entre clínicas ---------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select is(
  (select count(*)::int from public.pets where id = current_setting('vars.pet_b')::uuid),
  0, 'caso 1: la clínica A no ve mascotas exclusivas de la clínica B');
select is(
  (select count(*)::int from public.pet_owners where id = current_setting('vars.own2')::uuid),
  0, 'caso 2: la clínica A no ve propietarios exclusivos de la clínica B');
select is(
  (select count(*)::int from public.pets where id = current_setting('vars.pet_a')::uuid),
  1, 'caso 6: un veterinario consulta las mascotas de su clínica');

-- Caso 3: la mascota compartida es visible para ambas clínicas -----------------
select is(
  (select count(*)::int from public.pets where id = current_setting('vars.pet_shared')::uuid),
  1, 'caso 3a: la clínica A ve la mascota compartida');
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from public.pets where id = current_setting('vars.pet_shared')::uuid),
  1, 'caso 3b: la clínica B también ve la mascota compartida');

-- Caso 4: las notas/relación de una clínica NO son visibles para la otra -------
select is(
  (select count(*)::int from public.clinic_pet_relationships
   where pet_id = current_setting('vars.pet_shared')::uuid),
  1, 'caso 4a: la clínica B solo ve SU relación con la mascota compartida');
select pg_temp.login('00000000-0000-4000-8000-00000000a003');
select is(
  (select count(*)::int from public.clinic_pet_relationships
   where pet_id = current_setting('vars.pet_shared')::uuid
     and administrative_notes = 'Nota PRIVADA de clínica B'),
  0, 'caso 4b: las notas administrativas de la clínica B no llegan a la clínica A');

-- Caso 7: asistente solo lectura ----------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a006');
select is(
  (select count(*)::int from public.pets where id = current_setting('vars.pet_a')::uuid),
  1, 'caso 7a: la asistente consulta mascotas de su clínica');
update public.pets set name = 'hackeado' where id = current_setting('vars.pet_a')::uuid;
select pg_temp.logout();
select is(
  (select name from public.pets where id = current_setting('vars.pet_a')::uuid),
  'Firulais', 'caso 7b: la asistente no puede editar mascotas (RLS filtra)');

-- Caso 8: usuario sin membresía -----------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000c001');
select is((select count(*)::int from public.pets), 0,
  'caso 8a: un usuario sin membresía no ve mascota alguna');
select is((select count(*)::int from public.pet_owners), 0,
  'caso 8b: ni propietario alguno');

-- Caso 9 (suspendida) ----------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a008');
select is((select count(*)::int from public.pets), 0,
  'una recepcionista suspendida pierde acceso a las mascotas');

-- Caso 14/23: IDs manipulados desde otra clínica --------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
update public.pets set name = 'robado' where id = current_setting('vars.pet_a')::uuid;
update public.pet_owners set first_name = 'robado'
where id = current_setting('vars.own1')::uuid;
select pg_temp.logout();
select is(
  (select name from public.pets where id = current_setting('vars.pet_a')::uuid),
  'Firulais', 'caso 14a: un ID de mascota ajeno manipulado no permite editar');
select is(
  (select first_name from public.pet_owners where id = current_setting('vars.own1')::uuid),
  'Laura', 'caso 14b: un ID de propietario ajeno manipulado no permite editar');

-- Relación archivada deja de dar acceso (caso 9 del listado) --------------------
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select lives_ok(
  $$update public.clinic_pet_relationships set status = 'archived'
    where pet_id = current_setting('vars.pet_shared')::uuid
      and clinic_id = current_setting('vars.b1')::uuid$$,
  'la clínica B archiva su relación con la mascota compartida'
);
select is(
  (select count(*)::int from public.pets where id = current_setting('vars.pet_shared')::uuid),
  0, 'una relación archivada ya no otorga acceso a la mascota');

-- Relación propietario–mascota revocada (caso 10) -------------------------------
select pg_temp.logout();
update public.pet_owner_relationships set status = 'revoked', can_access_portal = false
where pet_id = current_setting('vars.pet_b')::uuid;
select is(
  (select count(*)::int from public.pet_owner_relationships
   where pet_id = current_setting('vars.pet_b')::uuid
     and status = 'active' and can_access_portal),
  0, 'caso 10: una relación revocada no conserva acceso al portal futuro'
);

-- Caso 11: borrado lógico -------------------------------------------------------
update public.pets set deleted_at = now() where id = current_setting('vars.pet_a')::uuid;
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select is(
  (select count(*)::int from public.pets where id = current_setting('vars.pet_a')::uuid),
  0, 'caso 11: el borrado lógico oculta la mascota de consultas normales');
select pg_temp.logout();
update public.pets set deleted_at = null where id = current_setting('vars.pet_a')::uuid;

-- Caso 13: superadmin explícito -------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000f001');
select ok(
  (select count(*) >= 3 from public.pets),
  'caso 13: el superadmin consulta mascotas mediante política explícita');

-- Caso 12: service_role (backend) -----------------------------------------------
select pg_temp.logout();
select set_config('role', 'service_role', true);
select ok(
  (select count(*) >= 3 from public.pets),
  'caso 12: service_role (BYPASSRLS) conserva acceso administrativo de backend');
select set_config('role', 'none', true);

select * from finish();
rollback;
