/**
 * Tipos compartidos de Dogtoralia.
 *
 * `database.types.ts` se GENERA desde PostgreSQL (`pnpm db:types`); nunca se
 * edita a mano y se regenera en el mismo PR que cambie el esquema
 * (CLAUDE.md §18). Los enums de dominio se derivan del archivo generado para
 * no duplicar literales.
 */
import { Constants, type Database } from "./database.types";

export type { Database, Json } from "./database.types";
export { Constants } from "./database.types";

// ---------------------------------------------------------------------------
// Tipos auxiliares de acceso al esquema
// ---------------------------------------------------------------------------
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

// ---------------------------------------------------------------------------
// Enums de dominio (derivados de la base de datos, no duplicados)
// ---------------------------------------------------------------------------
export const ORGANIZATION_STATUSES = Constants.public.Enums.organization_status;
export type OrganizationStatus = Enums<"organization_status">;

export const ORGANIZATION_ROLES = Constants.public.Enums.organization_role;
export type OrganizationRole = Enums<"organization_role">;

export const MEMBERSHIP_STATUSES = Constants.public.Enums.membership_status;
export type MembershipStatus = Enums<"membership_status">;

export const CLINIC_STATUSES = Constants.public.Enums.clinic_status;
export type ClinicStatus = Enums<"clinic_status">;

export const CLINIC_ROLES = Constants.public.Enums.clinic_role;
export type ClinicRole = Enums<"clinic_role">;

export const INVITATION_STATUSES = Constants.public.Enums.invitation_status;
export type InvitationStatus = Enums<"invitation_status">;

// ---------------------------------------------------------------------------
// Constantes de localización del producto (PRD §1)
// ---------------------------------------------------------------------------
export const DEFAULT_LOCALE = "es-MX" as const;
export const DEFAULT_TIMEZONE = "America/Mexico_City" as const;
export const DEFAULT_CURRENCY = "MXN" as const;

// ---------------------------------------------------------------------------
// Enums del dominio de pacientes (Fase 4), derivados de la base de datos
// ---------------------------------------------------------------------------
export const PET_SPECIES = Constants.public.Enums.pet_species;
export type PetSpecies = Enums<"pet_species">;

export const PET_SEXES = Constants.public.Enums.pet_sex;
export type PetSex = Enums<"pet_sex">;

export const OWNER_PET_RELATIONSHIP_TYPES = Constants.public.Enums.owner_pet_relationship_type;
export type OwnerPetRelationshipType = Enums<"owner_pet_relationship_type">;

export const CLINIC_PET_STATUSES = Constants.public.Enums.clinic_pet_status;
export type ClinicPetStatus = Enums<"clinic_pet_status">;

export const PET_ALERT_TYPES = Constants.public.Enums.pet_alert_type;
export type PetAlertType = Enums<"pet_alert_type">;

export const PET_ALERT_SEVERITIES = Constants.public.Enums.pet_alert_severity;
export type PetAlertSeverity = Enums<"pet_alert_severity">;

export const CONTACT_METHODS = Constants.public.Enums.contact_method;
export type ContactMethod = Enums<"contact_method">;

export const CONSENT_TYPES = Constants.public.Enums.consent_type;
export type ConsentType = Enums<"consent_type">;
