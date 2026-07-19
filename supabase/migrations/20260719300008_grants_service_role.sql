-- ============================================================================
-- Privilegios explícitos para service_role (backend)
-- ============================================================================
-- En el entorno canónico de Supabase, las tablas creadas por las migraciones
-- no reciben automáticamente privilegios para service_role, por lo que el
-- backend (Edge Functions / CI) quedaría sin acceso pese a su BYPASSRLS.
-- Los privilegios se otorgan tabla por tabla, de forma explícita, para no
-- depender de default privileges del entorno (defensa en profundidad y
-- paridad entre el runner local y Supabase real).
--
-- audit_log es la excepción deliberada: es append-only también para el
-- backend (solo SELECT e INSERT; ver 20260719100006_audit_log.sql).

-- Fase 2: identidad y tenancy
grant all on table public.reserved_slugs to service_role;
grant all on table public.profiles to service_role;
grant all on table public.organizations to service_role;
grant all on table public.organization_members to service_role;
grant all on table public.clinics to service_role;
grant all on table public.clinic_members to service_role;
grant all on table public.clinic_invitations to service_role;
grant select, insert on table public.audit_log to service_role;
revoke update, delete, truncate on table public.audit_log from service_role;

-- Fase 3: visibilidad de colegas
grant select on table public.colleague_profiles to service_role;

-- Fase 4: propietarios y mascotas
grant all on table public.pet_owners to service_role;
grant all on table public.pets to service_role;
grant all on table public.pet_owner_relationships to service_role;
grant all on table public.clinic_pet_relationships to service_role;
grant all on table public.owner_clinic_relationships to service_role;
grant all on table public.pet_alerts to service_role;
grant all on table public.owner_consents to service_role;
