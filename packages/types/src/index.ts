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
