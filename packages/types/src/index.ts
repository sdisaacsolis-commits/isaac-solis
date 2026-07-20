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

// ---------------------------------------------------------------------------
// Enums del dominio de agenda (Fase 5), derivados de la base de datos
// ---------------------------------------------------------------------------
export const SERVICE_CATEGORIES = Constants.public.Enums.service_category;
export type ServiceCategory = Enums<"service_category">;

export const SCHEDULE_EXCEPTION_TYPES = Constants.public.Enums.schedule_exception_type;
export type ScheduleExceptionType = Enums<"schedule_exception_type">;

export const APPOINTMENT_STATUSES = Constants.public.Enums.appointment_status;
export type AppointmentStatus = Enums<"appointment_status">;

export const APPOINTMENT_SOURCES = Constants.public.Enums.appointment_source;
export type AppointmentSource = Enums<"appointment_source">;

export const NOTIFICATION_CHANNELS = Constants.public.Enums.notification_channel;
export type NotificationChannel = Enums<"notification_channel">;

export const APPOINTMENT_NOTIFICATION_TYPES = Constants.public.Enums.appointment_notification_type;
export type AppointmentNotificationType = Enums<"appointment_notification_type">;

export const NOTIFICATION_STATUSES = Constants.public.Enums.notification_status;
export type NotificationStatus = Enums<"notification_status">;

/**
 * Máquina de estados de citas (espejo de appointment_transition_allowed en
 * SQL, que es la autoridad). La UI la usa para mostrar solo acciones válidas;
 * la base rechaza cualquier transición inválida aunque la UI falle.
 */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  requested: ["pending_confirmation", "confirmed", "cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
} as const;

/** Estados que ocupan agenda (espejo del WHERE del EXCLUDE anti-traslape). */
export const OCCUPYING_APPOINTMENT_STATUSES = [
  "pending_confirmation",
  "confirmed",
  "checked_in",
  "in_progress",
] as const satisfies readonly AppointmentStatus[];

// ---------------------------------------------------------------------------
// Enums del expediente clínico (Fase 6), derivados de la base de datos
// ---------------------------------------------------------------------------
export const ENCOUNTER_STATUSES = Constants.public.Enums.encounter_status;
export type EncounterStatus = Enums<"encounter_status">;

export const ENCOUNTER_TYPES = Constants.public.Enums.encounter_type;
export type EncounterType = Enums<"encounter_type">;

export const DIAGNOSIS_CERTAINTIES = Constants.public.Enums.diagnosis_certainty;
export type DiagnosisCertainty = Enums<"diagnosis_certainty">;

export const TREATMENT_TYPES = Constants.public.Enums.treatment_type;
export type TreatmentType = Enums<"treatment_type">;

export const CLINICAL_FILE_KINDS = Constants.public.Enums.clinical_file_kind;
export type ClinicalFileKind = Enums<"clinical_file_kind">;

export const FOLLOW_UP_STATUSES = Constants.public.Enums.follow_up_status;
export type FollowUpStatus = Enums<"follow_up_status">;

/**
 * Máquina de estados de consultas (espejo de encounter_transition_allowed en
 * SQL, que es la autoridad). draft e in_progress están fusionados: la consulta
 * abierta ES el borrador; finalized→voided es la anulación administrativa.
 */
export const ENCOUNTER_TRANSITIONS: Record<EncounterStatus, readonly EncounterStatus[]> = {
  in_progress: ["finalized", "voided"],
  finalized: ["voided"],
  voided: [],
} as const;
