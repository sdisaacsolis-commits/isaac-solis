-- ============================================================================
-- Fase 5 — RLS, privilegios y auditoría de la agenda
-- ============================================================================
-- Mismo modelo que fases anteriores: privilegios mínimos por columna,
-- políticas explícitas por operación (nunca FOR ALL) y auditoría por trigger.
-- Las escrituras con invariantes (agendar, transicionar, reagendar, cancelar,
-- configurar horarios) SOLO existen como RPCs: los clientes no tienen INSERT
-- sobre citas ni horarios.
-- ============================================================================

-- Helper: ¿la cita pertenece a una clínica accesible para quien consulta?
create or replace function public.appointment_clinic_accessible(p_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id
      and public.is_clinic_member(a.clinic_id)
  );
$$;

revoke all on function public.appointment_clinic_accessible(uuid) from public, anon;
grant execute on function public.appointment_clinic_accessible(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Privilegios (revocar amplio, otorgar mínimo; service_role explícito).
-- ----------------------------------------------------------------------------
revoke all on table public.clinic_services from public, anon, authenticated;
grant select on table public.clinic_services to authenticated;
grant update (name, category, description, duration_minutes, buffer_before_minutes,
              buffer_after_minutes, price_cents, requires_veterinarian, active)
  on table public.clinic_services to authenticated;
grant all on table public.clinic_services to service_role;

revoke all on table public.clinic_service_veterinarians from public, anon, authenticated;
grant select on table public.clinic_service_veterinarians to authenticated;
grant insert (clinic_service_id, clinic_member_id)
  on table public.clinic_service_veterinarians to authenticated;
grant delete on table public.clinic_service_veterinarians to authenticated;
grant all on table public.clinic_service_veterinarians to service_role;

revoke all on table public.veterinarian_schedules from public, anon, authenticated;
grant select on table public.veterinarian_schedules to authenticated;
grant all on table public.veterinarian_schedules to service_role;

revoke all on table public.schedule_exceptions from public, anon, authenticated;
grant select on table public.schedule_exceptions to authenticated;
grant insert (organization_id, clinic_id, clinic_member_id, type, starts_at, ends_at, reason)
  on table public.schedule_exceptions to authenticated;
grant update (type, starts_at, ends_at, reason) on table public.schedule_exceptions to authenticated;
grant delete on table public.schedule_exceptions to authenticated;
grant all on table public.schedule_exceptions to service_role;

revoke all on table public.appointments from public, anon, authenticated;
grant select on table public.appointments to authenticated;
grant all on table public.appointments to service_role;

revoke all on table public.appointment_services from public, anon, authenticated;
grant select on table public.appointment_services to authenticated;
grant all on table public.appointment_services to service_role;

revoke all on table public.appointment_status_history from public, anon, authenticated;
grant select on table public.appointment_status_history to authenticated;
-- Append-only también para el backend (mismo criterio que audit_log).
grant select, insert on table public.appointment_status_history to service_role;
revoke update, delete, truncate on table public.appointment_status_history from service_role;

revoke all on table public.appointment_notifications from public, anon, authenticated;
grant select on table public.appointment_notifications to authenticated;
grant all on table public.appointment_notifications to service_role;

revoke all on table public.appointment_folio_counters from public, anon, authenticated;
grant all on table public.appointment_folio_counters to service_role;

-- ----------------------------------------------------------------------------
-- Políticas explícitas por operación
-- ----------------------------------------------------------------------------

-- Catálogo de servicios: lo ve el personal de la clínica; lo administra el
-- admin de clínica (u organización, vía is_clinic_admin).
create policy clinic_services_select_membresia on public.clinic_services
  for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy clinic_services_select_superadmin on public.clinic_services
  for select to authenticated
  using (public.current_user_is_superadmin());
create policy clinic_services_update_admin on public.clinic_services
  for update to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

-- Asignación servicio↔veterinario: administra el admin de clínica.
create policy clinic_service_veterinarians_select_membresia on public.clinic_service_veterinarians
  for select to authenticated
  using (exists (
    select 1 from public.clinic_services s
    where s.id = clinic_service_id and public.is_clinic_member(s.clinic_id)
  ));
create policy clinic_service_veterinarians_select_superadmin on public.clinic_service_veterinarians
  for select to authenticated
  using (public.current_user_is_superadmin());
create policy clinic_service_veterinarians_insert_admin on public.clinic_service_veterinarians
  for insert to authenticated
  with check (exists (
    select 1 from public.clinic_services s
    where s.id = clinic_service_id and public.is_clinic_admin(s.clinic_id)
  ));
create policy clinic_service_veterinarians_delete_admin on public.clinic_service_veterinarians
  for delete to authenticated
  using (exists (
    select 1 from public.clinic_services s
    where s.id = clinic_service_id and public.is_clinic_admin(s.clinic_id)
  ));

-- Horarios: los ve el personal; se escriben solo por RPC (sin grants DML).
create policy veterinarian_schedules_select_membresia on public.veterinarian_schedules
  for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy veterinarian_schedules_select_superadmin on public.veterinarian_schedules
  for select to authenticated
  using (public.current_user_is_superadmin());

-- Excepciones: las ve el personal; las administra el admin de clínica o el
-- propio profesional (sus vacaciones/permisos).
create policy schedule_exceptions_select_membresia on public.schedule_exceptions
  for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy schedule_exceptions_select_superadmin on public.schedule_exceptions
  for select to authenticated
  using (public.current_user_is_superadmin());
create policy schedule_exceptions_insert_admin_o_propia on public.schedule_exceptions
  for insert to authenticated
  with check (
    public.is_clinic_admin(clinic_id)
    or (clinic_member_id is not null and exists (
      select 1 from public.clinic_members m
      where m.id = clinic_member_id
        and m.user_id = (select auth.uid())
        and m.clinic_id = schedule_exceptions.clinic_id
        and m.status = 'active'
        and m.deleted_at is null
    ))
  );
create policy schedule_exceptions_update_admin_o_propia on public.schedule_exceptions
  for update to authenticated
  using (
    public.is_clinic_admin(clinic_id)
    or exists (
      select 1 from public.clinic_members m
      where m.id = clinic_member_id and m.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_clinic_admin(clinic_id)
    or exists (
      select 1 from public.clinic_members m
      where m.id = clinic_member_id and m.user_id = (select auth.uid())
    )
  );
create policy schedule_exceptions_delete_admin_o_propia on public.schedule_exceptions
  for delete to authenticated
  using (
    public.is_clinic_admin(clinic_id)
    or exists (
      select 1 from public.clinic_members m
      where m.id = clinic_member_id and m.user_id = (select auth.uid())
    )
  );

-- Citas: las ve el personal de la clínica. Escrituras SOLO por RPC.
create policy appointments_select_membresia on public.appointments
  for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy appointments_select_superadmin on public.appointments
  for select to authenticated
  using (public.current_user_is_superadmin());

create policy appointment_services_select_membresia on public.appointment_services
  for select to authenticated
  using (public.appointment_clinic_accessible(appointment_id));
create policy appointment_services_select_superadmin on public.appointment_services
  for select to authenticated
  using (public.current_user_is_superadmin());

create policy appointment_status_history_select_membresia on public.appointment_status_history
  for select to authenticated
  using (public.appointment_clinic_accessible(appointment_id));
create policy appointment_status_history_select_superadmin on public.appointment_status_history
  for select to authenticated
  using (public.current_user_is_superadmin());

-- Outbox: lo consulta el personal operativo (estado de recordatorios).
create policy appointment_notifications_select_operativo on public.appointment_notifications
  for select to authenticated
  using (public.is_clinic_operational_staff(clinic_id));
create policy appointment_notifications_select_superadmin on public.appointment_notifications
  for select to authenticated
  using (public.current_user_is_superadmin());

-- ----------------------------------------------------------------------------
-- Auditoría: extender el resolvedor de contexto a las tablas de agenda.
-- ----------------------------------------------------------------------------
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
    when 'clinic_services', 'veterinarian_schedules', 'schedule_exceptions',
         'appointments', 'appointment_notifications' then
      v_organization_id := coalesce(v_new ->> 'organization_id', v_old ->> 'organization_id')::uuid;
      v_clinic_id := coalesce(v_new ->> 'clinic_id', v_old ->> 'clinic_id')::uuid;
    when 'clinic_service_veterinarians' then
      select s.organization_id, s.clinic_id into v_organization_id, v_clinic_id
      from public.clinic_services s
      where s.id = coalesce(v_new ->> 'clinic_service_id', v_old ->> 'clinic_service_id')::uuid;
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

create trigger clinic_services_audit
  after insert or update or delete on public.clinic_services
  for each row execute function public.audit_row_change();
create trigger clinic_service_veterinarians_audit
  after insert or update or delete on public.clinic_service_veterinarians
  for each row execute function public.audit_row_change();
create trigger veterinarian_schedules_audit
  after insert or update or delete on public.veterinarian_schedules
  for each row execute function public.audit_row_change();
create trigger schedule_exceptions_audit
  after insert or update or delete on public.schedule_exceptions
  for each row execute function public.audit_row_change();
create trigger appointments_audit
  after insert or update or delete on public.appointments
  for each row execute function public.audit_row_change();
