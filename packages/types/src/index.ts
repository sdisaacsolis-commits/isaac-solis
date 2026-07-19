/**
 * Tipos de dominio compartidos de Dogtoralia.
 *
 * Regla (CLAUDE.md §18): tras cada cambio de esquema en `supabase/migrations/`,
 * regenerar `database.types.ts` con `pnpm db:types` en el mismo PR.
 */

export type { Database } from "./database.types";

/** Roles de plataforma y de clínica (ver DATABASE_DESIGN.md §3.1 y §5). */
export const CLINIC_ROLES = ["clinic_admin", "veterinarian", "receptionist"] as const;
export type ClinicRole = (typeof CLINIC_ROLES)[number];

export const ORGANIZATION_ROLES = ["org_owner", "org_admin"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

/** Ciclo de vida comercial de una clínica (decisión confirmada, PRD §7.3). */
export const CLINIC_STATUSES = [
  "trial",
  "active",
  "past_due",
  "suspended",
  "cancelled",
  "archived",
] as const;
export type ClinicStatus = (typeof CLINIC_STATUSES)[number];

/** Constantes de localización del producto (PRD §1). */
export const DEFAULT_LOCALE = "es-MX" as const;
export const DEFAULT_TIMEZONE = "America/Mexico_City" as const;
export const DEFAULT_CURRENCY = "MXN" as const;
