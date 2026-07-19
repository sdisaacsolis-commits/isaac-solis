-- ============================================================================
-- Migración 0017 — Políticas RLS, privilegios y auditoría del dominio de
-- pacientes (Fase 4)
-- ============================================================================
-- Mismos principios de la Fase 2: denegado por defecto, políticas explícitas
-- por operación, privilegios de columna como defensa en profundidad, borrado
-- lógico oculto, superadmin explícito, INSERT multi-fila solo vía RPC.
-- ============================================================================

-- Privilegios ----------------------------------------------------------------
revoke all on table public.pet_owners from public, anon, authenticated;
grant select on table public.pet_owners to authenticated;
grant update (first_name, last_name, display_name, email, phone, secondary_phone,
              preferred_contact_method, address_line_1, address_line_2, neighborhood,
              city, state, postal_code)
  on table public.pet_owners to authenticated;

revoke all on table public.pets from public, anon, authenticated;
grant select on table public.pets to authenticated;
grant update (name, species, breed, sex, birth_date, approximate_birth_date, color,
              identifying_marks, microchip_number, sterilized, deceased_at, photo_path)
  on table public.pets to authenticated;

revoke all on table public.pet_owner_relationships from public, anon, authenticated;
grant select on table public.pet_owner_relationships to authenticated;
-- is_primary NO es actualizable directamente: solo la RPC set_primary_pet_owner.
grant update (relationship_type, can_make_medical_decisions, can_receive_notifications,
              can_access_portal, status, ended_at)
  on table public.pet_owner_relationships to authenticated;

revoke all on table public.clinic_pet_relationships from public, anon, authenticated;
grant select on table public.clinic_pet_relationships to authenticated;
grant update (internal_patient_number, status, administrative_notes, last_visit_at)
  on table public.clinic_pet_relationships to authenticated;

revoke all on table public.owner_clinic_relationships from public, anon, authenticated;
grant select on table public.owner_clinic_relationships to authenticated;
grant update (internal_customer_number, status, administrative_notes)
  on table public.owner_clinic_relationships to authenticated;

revoke all on table public.pet_alerts from public, anon, authenticated;
grant select on table public.pet_alerts to authenticated;
grant insert (organization_id, clinic_id, pet_id, type, severity, title, description,
              active, created_by)
  on table public.pet_alerts to authenticated;
grant update (severity, title, description, active, resolved_at, resolved_by)
  on table public.pet_alerts to authenticated;

revoke all on table public.owner_consents from public, anon, authenticated;
grant select on table public.owner_consents to authenticated;
grant insert (owner_id, organization_id, clinic_id, type, document_version, granted_at,
              medium, recorded_by, metadata)
  on table public.owner_consents to authenticated;
grant update (revoked_at, revoked_by) on table public.owner_consents to authenticated;

-- Políticas -------------------------------------------------------------------
-- pet_owners
create policy pet_owners_select_relacionados
  on public.pet_owners for select to authenticated
  using (deleted_at is null and public.can_access_owner(id));
create policy pet_owners_select_superadmin
  on public.pet_owners for select to authenticated
  using (public.current_user_is_superadmin());
create policy pet_owners_update_gestores
  on public.pet_owners for update to authenticated
  using (deleted_at is null and public.can_manage_owner(id))
  with check (public.can_manage_owner(id));
-- INSERT: solo RPC register_owner_with_clinic. DELETE: backend.

-- pets
create policy pets_select_relacionadas
  on public.pets for select to authenticated
  using (deleted_at is null and public.can_access_pet(id));
create policy pets_select_superadmin
  on public.pets for select to authenticated
  using (public.current_user_is_superadmin());
create policy pets_update_gestores
  on public.pets for update to authenticated
  using (deleted_at is null and public.can_manage_pet(id))
  with check (public.can_manage_pet(id));
-- INSERT: solo RPC register_pet_with_relationships. DELETE: backend.

-- pet_owner_relationships (visibles para quien accede a la mascota)
create policy pet_owner_relationships_select_por_mascota
  on public.pet_owner_relationships for select to authenticated
  using (deleted_at is null and public.can_access_pet(pet_id));
create policy pet_owner_relationships_select_superadmin
  on public.pet_owner_relationships for select to authenticated
  using (public.current_user_is_superadmin());
create policy pet_owner_relationships_update_gestores
  on public.pet_owner_relationships for update to authenticated
  using (deleted_at is null and public.can_manage_pet(pet_id))
  with check (public.can_manage_pet(pet_id));
-- INSERT: RPCs (registro y add_pet_owner).

-- clinic_pet_relationships: SOLO la clínica dueña de la relación (y admins de
-- su organización). Otra clínica que comparta la mascota NO ve estas filas
-- (número interno, notas y fuente son privados por clínica).
create policy clinic_pet_relationships_select_propia_clinica
  on public.clinic_pet_relationships for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_clinic_member(clinic_id)
      or public.is_organization_admin(organization_id)
    )
  );
create policy clinic_pet_relationships_select_superadmin
  on public.clinic_pet_relationships for select to authenticated
  using (public.current_user_is_superadmin());
create policy clinic_pet_relationships_update_staff
  on public.clinic_pet_relationships for update to authenticated
  using (deleted_at is null and public.is_clinic_operational_staff(clinic_id))
  with check (public.is_clinic_operational_staff(clinic_id));
-- INSERT: RPCs (registro y link_pet_to_clinic).

-- owner_clinic_relationships: mismas reglas de privacidad por clínica.
create policy owner_clinic_relationships_select_propia_clinica
  on public.owner_clinic_relationships for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_clinic_member(clinic_id)
      or public.is_organization_admin(organization_id)
    )
  );
create policy owner_clinic_relationships_select_superadmin
  on public.owner_clinic_relationships for select to authenticated
  using (public.current_user_is_superadmin());
create policy owner_clinic_relationships_update_gestion
  on public.owner_clinic_relationships for update to authenticated
  using (
    deleted_at is null
    and (
      public.is_clinic_admin(clinic_id)
      or public.is_organization_admin(organization_id)
      or exists (
        select 1 from public.clinic_members m
        where m.clinic_id = owner_clinic_relationships.clinic_id
          and m.user_id = (select auth.uid())
          and m.role = 'receptionist'
          and m.status = 'active'
          and m.deleted_at is null
      )
    )
  )
  with check (
    public.is_clinic_operational_staff(clinic_id)
  );
-- INSERT: RPC register_owner_with_clinic.

-- pet_alerts: exclusivas de su clínica.
create policy pet_alerts_select_propia_clinica
  on public.pet_alerts for select to authenticated
  using (public.is_clinic_member(clinic_id) or public.is_organization_admin(organization_id));
create policy pet_alerts_select_superadmin
  on public.pet_alerts for select to authenticated
  using (public.current_user_is_superadmin());
create policy pet_alerts_insert_staff
  on public.pet_alerts for insert to authenticated
  with check (
    public.is_clinic_operational_staff(clinic_id)
    and public.has_active_clinic_pet_relationship(clinic_id, pet_id)
    and created_by = (select auth.uid())
  );
create policy pet_alerts_update_staff
  on public.pet_alerts for update to authenticated
  using (public.is_clinic_operational_staff(clinic_id))
  with check (public.is_clinic_operational_staff(clinic_id));

-- owner_consents: los ve quien accede al propietario; los registra quien lo
-- gestiona; solo se revocan (columnas limitadas), nunca se borran.
create policy owner_consents_select_relacionados
  on public.owner_consents for select to authenticated
  using (public.can_access_owner(owner_id));
create policy owner_consents_select_superadmin
  on public.owner_consents for select to authenticated
  using (public.current_user_is_superadmin());
create policy owner_consents_insert_gestores
  on public.owner_consents for insert to authenticated
  with check (
    public.can_manage_owner(owner_id)
    and recorded_by = (select auth.uid())
  );
create policy owner_consents_update_revocar
  on public.owner_consents for update to authenticated
  using (public.can_manage_owner(owner_id))
  with check (public.can_manage_owner(owner_id));

-- Auditoría -------------------------------------------------------------------
-- Se REEMPLAZA la función genérica (vía migración nueva; la 0007 permanece
-- intacta) para extraer organization_id/clinic_id de las tablas nuevas.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_organization_id uuid;
  v_clinic_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old) - 'token_hash';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new) - 'token_hash';
  end if;

  case tg_table_name
    when 'organizations' then
      v_organization_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
    when 'organization_members' then
      v_organization_id := coalesce(v_new ->> 'organization_id', v_old ->> 'organization_id')::uuid;
    when 'clinics' then
      v_organization_id := coalesce(v_new ->> 'organization_id', v_old ->> 'organization_id')::uuid;
      v_clinic_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
    when 'clinic_members', 'clinic_invitations' then
      v_clinic_id := coalesce(v_new ->> 'clinic_id', v_old ->> 'clinic_id')::uuid;
      select c.organization_id into v_organization_id
      from public.clinics c where c.id = v_clinic_id;
    when 'clinic_pet_relationships', 'owner_clinic_relationships', 'pet_alerts' then
      v_organization_id := coalesce(v_new ->> 'organization_id', v_old ->> 'organization_id')::uuid;
      v_clinic_id := coalesce(v_new ->> 'clinic_id', v_old ->> 'clinic_id')::uuid;
    when 'owner_consents' then
      v_organization_id := coalesce(v_new ->> 'organization_id', v_old ->> 'organization_id')::uuid;
      v_clinic_id := coalesce(v_new ->> 'clinic_id', v_old ->> 'clinic_id')::uuid;
    else
      -- pets, pet_owners, pet_owner_relationships: identidad global sin
      -- organización; el registro conserva actor, entidad y datos.
      v_organization_id := null;
  end case;

  insert into public.audit_log
    (organization_id, clinic_id, actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_organization_id,
    v_clinic_id,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id')::uuid,
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;

create trigger pet_owners_audit
  after insert or update or delete on public.pet_owners
  for each row execute function public.audit_row_change();
create trigger pets_audit
  after insert or update or delete on public.pets
  for each row execute function public.audit_row_change();
create trigger pet_owner_relationships_audit
  after insert or update or delete on public.pet_owner_relationships
  for each row execute function public.audit_row_change();
create trigger clinic_pet_relationships_audit
  after insert or update or delete on public.clinic_pet_relationships
  for each row execute function public.audit_row_change();
create trigger owner_clinic_relationships_audit
  after insert or update or delete on public.owner_clinic_relationships
  for each row execute function public.audit_row_change();
create trigger pet_alerts_audit
  after insert or update or delete on public.pet_alerts
  for each row execute function public.audit_row_change();
create trigger owner_consents_audit
  after insert or update or delete on public.owner_consents
  for each row execute function public.audit_row_change();
