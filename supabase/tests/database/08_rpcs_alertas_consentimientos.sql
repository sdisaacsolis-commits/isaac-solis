-- ============================================================================
-- pgTAP 08 — Fase 4: RPCs transaccionales, alertas, consentimientos y Storage
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
  ('00000000-0000-4000-8000-00000000a004', 'vet.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a005', 'recepcion.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000a006', 'asistente.a@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b002', 'admin.clinica.b@ejemplo.mx'),
  ('00000000-0000-4000-8000-00000000b001', 'dueno.b@ejemplo.mx');

select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select set_config('vars.org_a', public.create_organization_with_owner('Vet Luna')::text, true);
select set_config('vars.a1', public.create_clinic_with_admin(
  current_setting('vars.org_a')::uuid, 'Clínica Luna Centro')::text, true);
select set_config('vars.a2', public.create_clinic_with_admin(
  current_setting('vars.org_a')::uuid, 'Clínica Luna Norte')::text, true);
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
select current_setting('vars.org_a')::uuid, u.id, 'member', 'active', now(),
       '00000000-0000-4000-8000-00000000a001'
from (values ('00000000-0000-4000-8000-00000000a004'::uuid),
             ('00000000-0000-4000-8000-00000000a005'::uuid),
             ('00000000-0000-4000-8000-00000000a006'::uuid)) as u (id);
insert into public.clinic_members (clinic_id, user_id, role, status, joined_at, created_by)
values
  (current_setting('vars.a1')::uuid, '00000000-0000-4000-8000-00000000a004', 'veterinarian', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.a1')::uuid, '00000000-0000-4000-8000-00000000a005', 'receptionist', 'active', now(), '00000000-0000-4000-8000-00000000a001'),
  (current_setting('vars.a1')::uuid, '00000000-0000-4000-8000-00000000a006', 'assistant', 'active', now(), '00000000-0000-4000-8000-00000000a001');

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

-- Propietarios y mascotas base -------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select set_config('vars.own1', public.register_owner_with_clinic(
  current_setting('vars.a1')::uuid, 'Laura', 'Ramírez', 'laura@ejemplo.mx', '+525511112222')::text, true);
select set_config('vars.own3', public.register_owner_with_clinic(
  current_setting('vars.a1')::uuid, 'Pedro', 'Ramírez', 'pedro@ejemplo.mx', '+525599998888')::text, true);
select set_config('vars.pet_a', public.register_pet_with_relationships(
  current_setting('vars.a1')::uuid, current_setting('vars.own1')::uuid,
  'Firulais', 'dog', 'Mestizo', 'male', '2022-03-01', false,
  null, null, 'CHIP-0001', true)::text, true);

-- Un veterinario NO registra propietarios --------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select throws_like(
  $$select public.register_owner_with_clinic(current_setting('vars.a1')::uuid, 'X', 'Y')$$,
  '%PERMISO_DENEGADO%',
  'un veterinario no puede registrar propietarios'
);

-- Rollback transaccional: microchip duplicado revierte TODO ---------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select throws_like(
  $$select public.register_pet_with_relationships(
      current_setting('vars.a1')::uuid, current_setting('vars.own1')::uuid,
      'Clon', 'dog', null, 'male', null, false, null, null, 'CHIP0001', null)$$,
  '%MICROCHIP_DUPLICADO%',
  'el microchip duplicado (normalizado) se bloquea'
);
select pg_temp.logout();
select is(
  (select count(*)::int from public.pets where name = 'Clon'),
  0, 'rollback: la mascota fallida no dejó fila en pets'
);
select is(
  (select count(*)::int from public.pet_owner_relationships r
   join public.pets p on p.id = r.pet_id where p.name = 'Clon'),
  0, 'rollback: tampoco quedaron relaciones huérfanas'
);

-- Propietarios múltiples y contacto principal -----------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select lives_ok(
  $$select public.add_pet_owner(current_setting('vars.pet_a')::uuid,
      current_setting('vars.own3')::uuid, 'family_member')$$,
  'se añade un segundo propietario'
);
select throws_like(
  $$select public.add_pet_owner(current_setting('vars.pet_a')::uuid,
      current_setting('vars.own3')::uuid, 'family_member')$$,
  '%RELACION_DUPLICADA%',
  'no se duplican relaciones propietario-mascota activas'
);
select throws_ok(
  $$update public.pet_owner_relationships set is_primary = true
    where pet_id = current_setting('vars.pet_a')::uuid$$,
  '42501', null,
  'is_primary NO es editable directamente (solo la RPC de transferencia)'
);
select lives_ok(
  $$select public.set_primary_pet_owner(current_setting('vars.pet_a')::uuid,
      current_setting('vars.own3')::uuid)$$,
  'la transferencia de contacto principal funciona'
);
select pg_temp.logout();
select is(
  (select count(*)::int from public.pet_owner_relationships
   where pet_id = current_setting('vars.pet_a')::uuid
     and is_primary and status = 'active' and deleted_at is null),
  1, 'sigue existiendo EXACTAMENTE un principal activo'
);
select is(
  (select owner_id from public.pet_owner_relationships
   where pet_id = current_setting('vars.pet_a')::uuid
     and is_primary and status = 'active'),
  current_setting('vars.own3')::uuid,
  'el principal es el propietario transferido'
);

-- Vincular a otra clínica -------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a001');
select lives_ok(
  $$select public.link_pet_to_clinic(current_setting('vars.pet_a')::uuid,
      current_setting('vars.a2')::uuid, 'referral', 'N-0001')$$,
  'la mascota se vincula a una segunda clínica del alcance del actor'
);
select throws_like(
  $$select public.link_pet_to_clinic(current_setting('vars.pet_a')::uuid,
      current_setting('vars.a2')::uuid)$$,
  '%RELACION_DUPLICADA%',
  'no se duplica la relación clínica-mascota activa'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select throws_like(
  $$select public.link_pet_to_clinic(current_setting('vars.pet_a')::uuid,
      current_setting('vars.b1')::uuid)$$,
  '%MASCOTA_NO_ACCESIBLE%',
  'la clínica B no puede vincularse una mascota fuera de su alcance (sin consentimiento)'
);

-- Alertas administrativas -------------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
with alerta as (
  insert into public.pet_alerts
    (organization_id, clinic_id, pet_id, type, severity, title, created_by)
  values (current_setting('vars.org_a')::uuid, current_setting('vars.a1')::uuid,
          current_setting('vars.pet_a')::uuid, 'handling_precaution', 'caution',
          'Usar bozal en revisión', '00000000-0000-4000-8000-00000000a004')
  returning id
)
select set_config('vars.alerta1', (select id from alerta)::text, true);
select is(
  (select count(*)::int from public.pet_alerts where active),
  1, 'un veterinario crea alertas administrativas de manejo'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a006');
select throws_ok(
  $$insert into public.pet_alerts
      (organization_id, clinic_id, pet_id, type, title, created_by)
    values (current_setting('vars.org_a')::uuid, current_setting('vars.a1')::uuid,
            current_setting('vars.pet_a')::uuid, 'other', 'x',
            '00000000-0000-4000-8000-00000000a006')$$,
  '42501', null,
  'una asistente no puede crear alertas'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from public.pet_alerts),
  0, 'las alertas son EXCLUSIVAS de la clínica que las creó'
);
select pg_temp.login('00000000-0000-4000-8000-00000000a004');
select lives_ok(
  $$update public.pet_alerts
    set active = false, resolved_at = now(),
        resolved_by = '00000000-0000-4000-8000-00000000a004'
    where id = current_setting('vars.alerta1')::uuid$$,
  'la alerta se resuelve'
);

-- Consentimientos versionados ---------------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
with consentimiento as (
  insert into public.owner_consents
    (owner_id, organization_id, clinic_id, type, document_version, medium, recorded_by)
  values (current_setting('vars.own1')::uuid, current_setting('vars.org_a')::uuid,
          current_setting('vars.a1')::uuid, 'privacy_notice', 'v1.0-2026', 'in_person',
          '00000000-0000-4000-8000-00000000a005')
  returning id
)
select set_config('vars.consent1', (select id from consentimiento)::text, true);
select is(
  (select document_version from public.owner_consents
   where id = current_setting('vars.consent1')::uuid),
  'v1.0-2026', 'el consentimiento queda versionado con fecha, medio y actor'
);
select throws_ok(
  $$delete from public.owner_consents where id = current_setting('vars.consent1')::uuid$$,
  '42501', null, 'los consentimientos no se borran desde clientes'
);
select lives_ok(
  $$update public.owner_consents
    set revoked_at = now(), revoked_by = '00000000-0000-4000-8000-00000000a005'
    where id = current_setting('vars.consent1')::uuid$$,
  'la revocación se registra'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from public.owner_consents),
  0, 'caso 17: los consentimientos de propietarios ajenos no son visibles'
);

-- Storage: fotos privadas por mascota -------------------------------------------
select pg_temp.login('00000000-0000-4000-8000-00000000a005');
select lives_ok(
  format(
    $sql$insert into storage.objects (bucket_id, name, owner)
         values ('pet-photos', 'pets/%s/11111111-1111-4111-8111-111111111111.webp',
                 '00000000-0000-4000-8000-00000000a005')$sql$,
    current_setting('vars.pet_a')
  ),
  'el personal autorizado sube la fotografía de su paciente'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'pet-photos'),
  1, 'el personal de la clínica ve la fotografía'
);
select pg_temp.login('00000000-0000-4000-8000-00000000b002');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'pet-photos'),
  0, 'caso 18: la fotografía es inaccesible para otra clínica sin relación'
);
select throws_ok(
  format(
    $sql$insert into storage.objects (bucket_id, name, owner)
         values ('pet-photos', 'pets/%s/22222222-2222-4222-8222-222222222222.webp',
                 '00000000-0000-4000-8000-00000000b002')$sql$,
    current_setting('vars.pet_a')
  ),
  '42501', null,
  'otra clínica no puede subir fotos de una mascota ajena'
);

-- Auditoría de la fase ----------------------------------------------------------
select pg_temp.logout();
select ok(
  (select count(*) > 0 from public.audit_log
   where entity_type = 'pets' and action = 'insert'),
  'las altas de mascotas quedan auditadas'
);
select ok(
  (select count(*) > 0 from public.audit_log
   where entity_type = 'pet_owner_relationships' and action = 'update'),
  'los cambios de relaciones (p. ej. principal) quedan auditados'
);
select ok(
  (select count(*) > 0 from public.audit_log
   where entity_type = 'owner_consents'),
  'los consentimientos quedan auditados'
);

select * from finish();
rollback;
