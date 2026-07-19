-- ============================================================================
-- pgTAP 01 — Esquema, RLS habilitado/forzado, políticas y funciones esperadas
-- ============================================================================
begin;
set search_path = public, extensions;
select * from no_plan();

-- Tablas -----------------------------------------------------------------
select has_table('public', 'profiles', 'existe profiles');
select has_table('public', 'reserved_slugs', 'existe reserved_slugs');
select has_table('public', 'organizations', 'existe organizations');
select has_table('public', 'organization_members', 'existe organization_members');
select has_table('public', 'clinics', 'existe clinics');
select has_table('public', 'clinic_members', 'existe clinic_members');
select has_table('public', 'clinic_invitations', 'existe clinic_invitations');
select has_table('public', 'audit_log', 'existe audit_log');

-- RLS habilitado Y forzado en TODA tabla del esquema public ---------------
select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not (c.relrowsecurity and c.relforcerowsecurity)
  ),
  0,
  'ninguna tabla de public carece de RLS habilitado y forzado'
);

-- Enums -------------------------------------------------------------------
select has_enum('public', 'organization_status', 'existe organization_status');
select enum_has_labels('public', 'organization_status',
  array['active', 'suspended', 'archived'], 'valores de organization_status');
select has_enum('public', 'organization_role', 'existe organization_role');
select enum_has_labels('public', 'organization_role',
  array['owner', 'admin', 'billing', 'member'], 'valores de organization_role');
select has_enum('public', 'membership_status', 'existe membership_status');
select enum_has_labels('public', 'membership_status',
  array['invited', 'active', 'suspended', 'removed'], 'valores de membership_status');
select has_enum('public', 'clinic_status', 'existe clinic_status');
select enum_has_labels('public', 'clinic_status',
  array['trial', 'active', 'past_due', 'suspended', 'cancelled', 'archived'],
  'valores de clinic_status');
select has_enum('public', 'clinic_role', 'existe clinic_role');
select enum_has_labels('public', 'clinic_role',
  array['clinic_admin', 'veterinarian', 'receptionist', 'assistant'], 'valores de clinic_role');
select has_enum('public', 'invitation_status', 'existe invitation_status');
select enum_has_labels('public', 'invitation_status',
  array['pending', 'accepted', 'expired', 'revoked'], 'valores de invitation_status');

-- Columnas y constraints clave -------------------------------------------
select col_is_pk('public', 'profiles', 'id', 'profiles.id es PK');
select col_not_null('public', 'clinic_invitations', 'token_hash', 'token_hash no nulo');
select col_not_null('public', 'clinics', 'organization_id', 'clinics.organization_id no nulo');
select col_has_default('public', 'clinics', 'status', 'clinics.status tiene default');
select col_default_is('public', 'clinics', 'timezone', 'America/Mexico_City',
  'zona horaria por defecto de clínica');
select col_default_is('public', 'clinics', 'currency', 'MXN', 'moneda por defecto MXN');
select col_default_is('public', 'clinics', 'country_code', 'MX', 'país por defecto MX');
select col_default_is('public', 'profiles', 'preferred_locale', 'es-MX', 'locale por defecto');

select has_index('public', 'organization_members', 'organization_members_una_membresia_viva',
  'índice único parcial de membresías vivas de organización');
select has_index('public', 'clinic_members', 'clinic_members_una_membresia_viva',
  'índice único parcial de membresías vivas de clínica');
select has_index('public', 'clinic_invitations', 'clinic_invitations_sin_pendientes_duplicadas',
  'índice único parcial de invitaciones pendientes');

-- Triggers ----------------------------------------------------------------
select has_trigger('public', 'profiles', 'profiles_protect_superadmin',
  'trigger de protección de is_superadmin');
select has_trigger('public', 'organization_members', 'organization_members_protect_last_owner',
  'trigger de último owner');
select has_trigger('public', 'clinics', 'clinics_validate_status_transition',
  'trigger de transiciones de estado de clínica');
select has_trigger('public', 'clinic_members', 'clinic_members_require_org_membership',
  'trigger de pertenencia previa a la organización');
select has_trigger('public', 'clinic_invitations', 'clinic_invitations_normalize_email',
  'trigger de normalización de correo');
select has_trigger('public', 'organizations', 'organizations_audit', 'auditoría en organizations');
select has_trigger('public', 'clinic_members', 'clinic_members_audit', 'auditoría en clinic_members');

-- Funciones auxiliares de seguridad ---------------------------------------
select has_function('public', 'current_user_is_superadmin', array[]::name[],
  'existe current_user_is_superadmin');
select has_function('public', 'is_organization_member', array['uuid'], 'existe is_organization_member');
select has_function('public', 'is_organization_admin', array['uuid'], 'existe is_organization_admin');
select has_function('public', 'is_organization_owner', array['uuid'], 'existe is_organization_owner');
select has_function('public', 'is_clinic_member', array['uuid'], 'existe is_clinic_member');
select has_function('public', 'is_clinic_admin', array['uuid'], 'existe is_clinic_admin');
select has_function('public', 'clinic_belongs_to_organization', array['uuid', 'uuid'],
  'existe clinic_belongs_to_organization');
select has_function('public', 'organization_of_clinic', array['uuid'], 'existe organization_of_clinic');

select is_definer('public', 'current_user_is_superadmin', array[]::name[],
  'current_user_is_superadmin es SECURITY DEFINER');
select is_definer('public', 'is_organization_member', array['uuid'],
  'is_organization_member es SECURITY DEFINER');
select is_definer('public', 'is_clinic_admin', array['uuid'], 'is_clinic_admin es SECURITY DEFINER');

-- RPCs ----------------------------------------------------------------------
select has_function('public', 'create_organization_with_owner',
  array['text', 'text', 'text', 'text'], 'existe create_organization_with_owner');
select has_function('public', 'invite_clinic_member', array['uuid', 'text', 'clinic_role'],
  'existe invite_clinic_member');
select has_function('public', 'accept_clinic_invitation', array['text'],
  'existe accept_clinic_invitation');

-- Políticas esperadas (explícitas por operación) ----------------------------
select policies_are('public', 'profiles',
  array['profiles_select_propio', 'profiles_select_superadmin', 'profiles_update_propio'],
  'políticas de profiles');
select policies_are('public', 'organizations',
  array['organizations_select_miembros', 'organizations_select_superadmin',
        'organizations_update_owner'],
  'políticas de organizations');
select policies_are('public', 'organization_members',
  array['organization_members_select_visibles', 'organization_members_insert_owner',
        'organization_members_insert_admin', 'organization_members_update_owner',
        'organization_members_update_admin'],
  'políticas de organization_members');
select policies_are('public', 'clinics',
  array['clinics_select_miembros', 'clinics_select_superadmin', 'clinics_insert_org_admin',
        'clinics_update_admins'],
  'políticas de clinics');
select policies_are('public', 'clinic_members',
  array['clinic_members_select_visibles', 'clinic_members_insert_admins',
        'clinic_members_update_admins'],
  'políticas de clinic_members');
select policies_are('public', 'clinic_invitations',
  array['clinic_invitations_select_admins', 'clinic_invitations_update_revocar'],
  'políticas de clinic_invitations');
select policies_are('public', 'audit_log',
  array['audit_log_select_org_admins', 'audit_log_select_superadmin'],
  'políticas de audit_log');
select policies_are('public', 'reserved_slugs',
  array['reserved_slugs_select_autenticados'], 'políticas de reserved_slugs');

-- Slugs reservados sembrados -------------------------------------------------
select ok(
  (select count(*) >= 12 from public.reserved_slugs),
  'lista inicial de slugs reservados sembrada'
);

select * from finish();
rollback;
