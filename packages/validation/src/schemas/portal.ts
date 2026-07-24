import { PET_SPECIES, SERVICE_CATEGORIES } from "@dogtoralia/types";
import { z } from "zod";

/**
 * Esquemas del portal público (Fase 8): búsqueda, reservación de invitado,
 * perfil público del veterinario y vinculación al portal del propietario.
 * La autoridad final es PostgreSQL (RPCs SECURITY DEFINER con datos curados).
 */

const uuidSchema = z.string().uuid("Identificador inválido.");
const textoCorto = (max: number) =>
  z.string().trim().max(max, `No puede exceder ${max} caracteres.`).optional();

export const publicSearchSchema = z.object({
  q: textoCorto(120),
  ciudad: textoCorto(120),
  categoria: z.enum(SERVICE_CATEGORIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const publicSlotsQuerySchema = z.object({
  clinicSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Clínica inválida."),
  serviceId: uuidSchema,
  veterinarianMemberId: uuidSchema,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
});

export const publicBookingSchema = z.object({
  clinicSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Clínica inválida."),
  serviceId: uuidSchema,
  veterinarianMemberId: uuidSchema,
  start: z.string().datetime({ offset: true, message: "Horario inválido." }),
  firstName: z
    .string({ required_error: "Tu nombre es obligatorio." })
    .trim()
    .min(1, "Tu nombre es obligatorio.")
    .max(100),
  lastName: z
    .string({ required_error: "Tus apellidos son obligatorios." })
    .trim()
    .min(1, "Tus apellidos son obligatorios.")
    .max(100),
  email: z
    .string({ required_error: "Tu correo es obligatorio." })
    .trim()
    .email("Captura un correo válido.")
    .max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+[0-9]{7,15}$/, "Usa formato internacional (+52…).")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  petName: z
    .string({ required_error: "El nombre de tu mascota es obligatorio." })
    .trim()
    .min(1, "El nombre de tu mascota es obligatorio.")
    .max(100),
  petSpecies: z.enum(PET_SPECIES, { errorMap: () => ({ message: "Especie inválida." }) }),
  reason: textoCorto(1000),
  requestId: uuidSchema,
});

export const vetPublicProfileSchema = z.object({
  slug: z
    .string({ required_error: "El identificador público es obligatorio." })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones.")
    .min(3, "Mínimo 3 caracteres.")
    .max(80, "Máximo 80 caracteres."),
  headline: textoCorto(200),
  bio: textoCorto(2000),
  isPublic: z.boolean().default(false),
});

export const portalInvitationSchema = z.object({
  clinicId: uuidSchema,
  ownerId: uuidSchema,
});

export const acceptPortalInvitationSchema = z.object({
  token: z
    .string({ required_error: "El enlace no es válido." })
    .trim()
    .regex(/^[0-9a-f]{64}$/, "El enlace de invitación no es válido."),
});

export const cancelMyAppointmentSchema = z.object({
  appointmentId: uuidSchema,
  reason: textoCorto(500),
});
