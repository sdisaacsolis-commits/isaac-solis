import { CLINIC_ROLES, ORGANIZATION_ROLES } from "@dogtoralia/types";
import { z } from "zod";

import { clinicSlugSchema, emailSchema, nonEmptyTextSchema, phoneMxSchema } from "./common";

/**
 * Esquemas de la capa de tenancy (Fase 2): organizaciones, clínicas,
 * membresías e invitaciones. Los roles/estados se derivan de los enums de la
 * base de datos vía @dogtoralia/types — sin literales duplicados.
 *
 * Estos esquemas validan la ENTRADA del cliente; la base de datos aplica sus
 * propias restricciones (RLS, CHECK, triggers) como última barrera.
 */

/** Rol de organización asignable desde la UI. */
export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES, {
  errorMap: () => ({ message: "Selecciona un rol de organización válido." }),
});

/** Rol de clínica asignable desde la UI. */
export const clinicRoleSchema = z.enum(CLINIC_ROLES, {
  errorMap: () => ({ message: "Selecciona un rol de clínica válido." }),
});

/** Código postal mexicano: exactamente 5 dígitos. */
export const postalCodeMxSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{5}$/, "El código postal debe tener 5 dígitos.");

/** RFC mexicano (validación ligera de forma; el SAT valida el fondo). */
export const rfcSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-ZÑ&0-9]{12,13}$/, "Ingresa un RFC válido de 12 o 13 caracteres.");

export const createOrganizationSchema = z.object({
  name: nonEmptyTextSchema.pipe(
    z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres.")
      .max(120, "El nombre no puede exceder 120 caracteres."),
  ),
  slug: clinicSlugSchema.optional(),
  legalName: z
    .string()
    .trim()
    .max(200, "La razón social no puede exceder 200 caracteres.")
    .optional(),
  taxId: rfcSchema.optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const createClinicSchema = z.object({
  organizationId: z.string().uuid("Identificador de organización inválido."),
  name: nonEmptyTextSchema.pipe(
    z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres.")
      .max(120, "El nombre no puede exceder 120 caracteres."),
  ),
  slug: clinicSlugSchema.optional(),
  description: z
    .string()
    .trim()
    .max(2000, "La descripción no puede exceder 2000 caracteres.")
    .optional(),
  email: emailSchema.optional(),
  phone: phoneMxSchema.optional(),
  timezone: z.string().trim().min(1).default("America/Mexico_City"),
  addressLine1: z
    .string()
    .trim()
    .max(200, "La dirección no puede exceder 200 caracteres.")
    .optional(),
  addressLine2: z
    .string()
    .trim()
    .max(200, "La dirección no puede exceder 200 caracteres.")
    .optional(),
  neighborhood: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: postalCodeMxSchema.optional(),
});

export const updateClinicSchema = createClinicSchema.omit({ organizationId: true }).partial();

export const inviteClinicMemberSchema = z.object({
  clinicId: z.string().uuid("Identificador de clínica inválido."),
  email: emailSchema,
  role: clinicRoleSchema,
});

export const changeClinicMemberRoleSchema = z.object({
  memberId: z.string().uuid("Identificador de membresía inválido."),
  role: clinicRoleSchema,
});

export const changeOrganizationMemberRoleSchema = z.object({
  memberId: z.string().uuid("Identificador de membresía inválido."),
  role: organizationRoleSchema,
});

export const profileSchema = z.object({
  firstName: z.string().trim().max(100, "El nombre no puede exceder 100 caracteres.").optional(),
  lastName: z
    .string()
    .trim()
    .max(100, "Los apellidos no pueden exceder 100 caracteres.")
    .optional(),
  displayName: z
    .string()
    .trim()
    .max(120, "El nombre para mostrar no puede exceder 120 caracteres.")
    .optional(),
  phone: phoneMxSchema.optional(),
  avatarUrl: z.string().url("Ingresa una URL válida.").optional(),
  preferredLocale: z.literal("es-MX").default("es-MX"),
  timezone: z.string().trim().min(1).default("America/Mexico_City"),
});

/** Perfil mínimo requerido para completar el onboarding (Fase 3). */
export const onboardingProfileSchema = profileSchema.extend({
  firstName: z
    .string({ required_error: "El nombre es obligatorio." })
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(100, "El nombre no puede exceder 100 caracteres."),
  lastName: z
    .string({ required_error: "Los apellidos son obligatorios." })
    .trim()
    .min(1, "Los apellidos son obligatorios.")
    .max(100, "Los apellidos no pueden exceder 100 caracteres."),
  displayName: z
    .string({ required_error: "El nombre para mostrar es obligatorio." })
    .trim()
    .min(1, "El nombre para mostrar es obligatorio.")
    .max(120, "El nombre para mostrar no puede exceder 120 caracteres."),
});
