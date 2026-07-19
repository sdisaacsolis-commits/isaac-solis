-- ============================================================================
-- Migración 0007 — Bitácora de auditoría (append-only)
-- ============================================================================
-- Registra automáticamente cambios en las tablas de tenancy. Es append-only
-- para TODOS los clientes: UPDATE y DELETE están revocados incluso para
-- service_role (la trazabilidad no se edita). Solo el rol postgres (dueño,
-- migraciones) podría depurar bajo política de retención futura.
--
-- Se audita automáticamente: organizations, organization_members, clinics,
-- clinic_members, clinic_invitations (sin token_hash) y el cambio del
-- indicador is_superadmin en profiles (vía trigger de protección).
-- Deberá auditarse desde backend en fases posteriores: accesos de soporte,
-- exportaciones de datos (ARCO) y acciones administrativas de plataforma.
-- ============================================================================

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid,
  clinic_id uuid,
  actor_user_id uuid, -- sin FK: la bitácora sobrevive a la baja del usuario
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Bitácora append-only. id bigint (no uuid): tabla de log de alto volumen con orden natural.';

create index audit_log_organization_idx on public.audit_log (organization_id, created_at desc);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

-- Append-only: nadie actualiza ni borra desde clientes (ni service_role).
revoke all on table public.audit_log from public, anon, authenticated;
revoke update, delete, truncate on table public.audit_log from service_role;
grant select on table public.audit_log to authenticated;

-- ----------------------------------------------------------------------------
-- Trigger genérico de auditoría.
-- SECURITY DEFINER: inserta en audit_log sin requerir privilegios del actor
-- (los clientes no tienen INSERT sobre audit_log, y no deben tenerlo).
-- Nunca persiste token_hash.
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
    else
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

revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger organizations_audit
  after insert or update or delete on public.organizations
  for each row execute function public.audit_row_change();

create trigger organization_members_audit
  after insert or update or delete on public.organization_members
  for each row execute function public.audit_row_change();

create trigger clinics_audit
  after insert or update or delete on public.clinics
  for each row execute function public.audit_row_change();

create trigger clinic_members_audit
  after insert or update or delete on public.clinic_members
  for each row execute function public.audit_row_change();

create trigger clinic_invitations_audit
  after insert or update or delete on public.clinic_invitations
  for each row execute function public.audit_row_change();

-- Cambios de is_superadmin: se registran con acción específica y sin volcar
-- el perfil completo (evita duplicar datos personales en la bitácora).
create or replace function public.audit_superadmin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    (select auth.uid()),
    'superadmin_change',
    'profiles',
    new.id,
    jsonb_build_object('is_superadmin', old.is_superadmin),
    jsonb_build_object('is_superadmin', new.is_superadmin)
  );
  return new;
end;
$$;

revoke all on function public.audit_superadmin_change() from public, anon, authenticated;

create trigger profiles_audit_superadmin
  after update on public.profiles
  for each row
  when (old.is_superadmin is distinct from new.is_superadmin)
  execute function public.audit_superadmin_change();
