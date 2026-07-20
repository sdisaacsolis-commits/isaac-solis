-- ============================================================================
-- Migración 0009 — Políticas RLS
-- ============================================================================
-- Políticas explícitas por operación (no una genérica por tabla). Principios:
--   * Denegado por defecto: sin política (y sin GRANT) no hay acceso.
--   * El borrado lógico (deleted_at) oculta filas en consultas normales.
--   * El superadmin accede mediante políticas EXPLÍCITAS (auditables), no
--     mediante bypass.
--   * service_role tiene BYPASSRLS (backend confiable): estas políticas
--     aplican a clientes anon/authenticated.
--   * Los miembros suspendidos pierden acceso operativo: todas las funciones
--     auxiliares exigen status = 'active'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create policy profiles_select_propio
  on public.profiles for select to authenticated
  using (deleted_at is null and id = (select auth.uid()));

create policy profiles_select_superadmin
  on public.profiles for select to authenticated
  using (public.current_user_is_superadmin());

create policy profiles_update_propio
  on public.profiles for update to authenticated
  using (deleted_at is null and id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Sin políticas de INSERT/DELETE: el alta la hace el trigger de auth.users y
-- la baja (anonimización) el backend con service_role.

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------
create policy organizations_select_miembros
  on public.organizations for select to authenticated
  using (deleted_at is null and public.is_organization_member(id));

create policy organizations_select_superadmin
  on public.organizations for select to authenticated
  using (public.current_user_is_superadmin());

-- Solo el owner edita los datos de identidad de la organización. El estado,
-- plan y límites no están en el GRANT de columnas: solo backend.
create policy organizations_update_owner
  on public.organizations for update to authenticated
  using (deleted_at is null and public.is_organization_owner(id))
  with check (public.is_organization_owner(id));

-- Sin política de INSERT: las organizaciones nacen por la RPC
-- create_organization_with_owner. Sin DELETE: baja lógica desde backend.

-- ----------------------------------------------------------------------------
-- organization_members
-- ----------------------------------------------------------------------------
create policy organization_members_select_visibles
  on public.organization_members for select to authenticated
  using (
    deleted_at is null
    and (
      user_id = (select auth.uid())            -- siempre veo mis membresías
      or public.is_organization_member(organization_id)
      or public.current_user_is_superadmin()
    )
  );

-- El owner administra cualquier membresía de SU organización.
create policy organization_members_insert_owner
  on public.organization_members for insert to authenticated
  with check (
    public.is_organization_owner(organization_id)
    and created_by = (select auth.uid())
  );

-- Un admin gestiona membresías de su organización pero NUNCA el rol owner
-- (ni crear owners ni tocar filas de owners): no puede elevar por encima de
-- su propio nivel.
create policy organization_members_insert_admin
  on public.organization_members for insert to authenticated
  with check (
    public.is_organization_admin(organization_id)
    and role <> 'owner'
    and created_by = (select auth.uid())
  );

create policy organization_members_update_owner
  on public.organization_members for update to authenticated
  using (deleted_at is null and public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

create policy organization_members_update_admin
  on public.organization_members for update to authenticated
  using (
    deleted_at is null
    and public.is_organization_admin(organization_id)
    and role <> 'owner'                        -- no toca filas de owners
  )
  with check (
    public.is_organization_admin(organization_id)
    and role <> 'owner'                        -- no convierte a nadie en owner
  );

-- Sin DELETE: la salida es status = 'removed' o borrado lógico (deleted_at).

-- ----------------------------------------------------------------------------
-- clinics
-- ----------------------------------------------------------------------------
create policy clinics_select_miembros
  on public.clinics for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_clinic_member(id)
      or public.is_organization_admin(organization_id)
    )
  );

create policy clinics_select_superadmin
  on public.clinics for select to authenticated
  using (public.current_user_is_superadmin());

-- Crear clínicas: admins/owners de la organización. Nacen en 'trial' (valor
-- por defecto; la columna status no está en el GRANT de INSERT).
create policy clinics_insert_org_admin
  on public.clinics for insert to authenticated
  with check (
    public.is_organization_admin(organization_id)
    and created_by = (select auth.uid())
  );

create policy clinics_update_admins
  on public.clinics for update to authenticated
  using (
    deleted_at is null
    and (
      public.is_organization_admin(organization_id)
      or public.is_clinic_admin(id)
    )
  )
  with check (
    public.is_organization_admin(organization_id)
    or public.is_clinic_admin(id)
  );

-- Sin DELETE: archivado/borrado lógico exclusivo del backend.

-- ----------------------------------------------------------------------------
-- clinic_members
-- ----------------------------------------------------------------------------
create policy clinic_members_select_visibles
  on public.clinic_members for select to authenticated
  using (
    deleted_at is null
    and (
      user_id = (select auth.uid())
      or public.is_clinic_member(clinic_id)
      or public.is_organization_admin(public.organization_of_clinic(clinic_id))
      or public.current_user_is_superadmin()
    )
  );

-- Solo administradores (de la clínica o de la organización) gestionan
-- membresías de clínica. clinic_admin es el rol máximo de clínica, por lo que
-- asignar cualquier clinic_role nunca eleva por encima del nivel del actor.
-- Recepcionistas, veterinarios y asistentes no tienen política alguna de
-- INSERT/UPDATE: no pueden cambiar roles (ni el propio).
create policy clinic_members_insert_admins
  on public.clinic_members for insert to authenticated
  with check (
    (
      public.is_organization_admin(public.organization_of_clinic(clinic_id))
      or public.is_clinic_admin(clinic_id)
    )
    and created_by = (select auth.uid())
  );

create policy clinic_members_update_admins
  on public.clinic_members for update to authenticated
  using (
    deleted_at is null
    and (
      public.is_organization_admin(public.organization_of_clinic(clinic_id))
      or public.is_clinic_admin(clinic_id)
    )
  )
  with check (
    public.is_organization_admin(public.organization_of_clinic(clinic_id))
    or public.is_clinic_admin(clinic_id)
  );

-- ----------------------------------------------------------------------------
-- clinic_invitations
-- ----------------------------------------------------------------------------
create policy clinic_invitations_select_admins
  on public.clinic_invitations for select to authenticated
  using (
    public.is_clinic_admin(clinic_id)
    or public.is_organization_admin(public.organization_of_clinic(clinic_id))
    or public.current_user_is_superadmin()
  );

-- La única mutación de clientes: revocar una invitación pendiente.
-- (El GRANT de UPDATE solo cubre la columna status.)
create policy clinic_invitations_update_revocar
  on public.clinic_invitations for update to authenticated
  using (
    status = 'pending'
    and (
      public.is_clinic_admin(clinic_id)
      or public.is_organization_admin(public.organization_of_clinic(clinic_id))
    )
  )
  with check (
    status = 'revoked'
    and (
      public.is_clinic_admin(clinic_id)
      or public.is_organization_admin(public.organization_of_clinic(clinic_id))
    )
  );

-- Sin INSERT (solo la RPC invite_clinic_member) ni DELETE.

-- ----------------------------------------------------------------------------
-- audit_log
-- ----------------------------------------------------------------------------
create policy audit_log_select_org_admins
  on public.audit_log for select to authenticated
  using (
    organization_id is not null
    and public.is_organization_admin(organization_id)
  );

create policy audit_log_select_superadmin
  on public.audit_log for select to authenticated
  using (public.current_user_is_superadmin());

-- Sin INSERT/UPDATE/DELETE para clientes: escribe únicamente el trigger
-- SECURITY DEFINER, y UPDATE/DELETE están además revocados a service_role.
