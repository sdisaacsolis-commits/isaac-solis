import {
  APPOINTMENT_STATUSES,
  SCHEDULE_EXCEPTION_TYPES,
  SERVICE_CATEGORIES,
} from "@dogtoralia/types";
import { z } from "zod";

/**
 * Esquemas del dominio de agenda (Fase 5). Mensajes es-MX; enums derivados de
 * la base vía @dogtoralia/types. Las horas de formularios viajan como cadenas
 * "HH:MM" o "YYYY-MM-DDTHH:MM" (datetime-local) en hora local de la clínica;
 * la conversión a UTC ocurre en la Server Action con la zona de la clínica.
 */

const uuidSchema = z.string().uuid("Identificador inválido.");

export const serviceCategorySchema = z.enum(SERVICE_CATEGORIES, {
  errorMap: () => ({ message: "Selecciona una categoría válida." }),
});

export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES, {
  errorMap: () => ({ message: "Estado de cita inválido." }),
});

export const scheduleExceptionTypeSchema = z.enum(SCHEDULE_EXCEPTION_TYPES, {
  errorMap: () => ({ message: "Selecciona un tipo de excepción válido." }),
});

/** Hora "HH:MM" de formularios (input type=time). */
export const timeOfDaySchema = z
  .string({ required_error: "La hora es obligatoria." })
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Usa el formato HH:MM.");

/** Fecha-hora local "YYYY-MM-DDTHH:MM" (input type=datetime-local). */
export const localDateTimeSchema = z
  .string({ required_error: "La fecha y hora son obligatorias." })
  .regex(
    /^\d{4}-\d{2}-\d{2}T([01][0-9]|2[0-3]):[0-5][0-9]$/,
    "Usa el formato de fecha y hora del formulario.",
  );

/** Fecha "YYYY-MM-DD". */
export const dateOnlySchema = z
  .string({ required_error: "La fecha es obligatoria." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD.");

/** Precio capturado en PESOS (admite centavos con punto); se guarda en centavos. */
export const precioPesosSchema = z.coerce
  .number({ invalid_type_error: "Escribe un precio válido." })
  .min(0, "El precio no puede ser negativo.")
  .max(1_000_000, "El precio no puede exceder $1,000,000.")
  .transform((pesos) => Math.round(pesos * 100));

export const createServiceSchema = z.object({
  clinicId: uuidSchema,
  name: z
    .string({ required_error: "El nombre es obligatorio." })
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(120, "El nombre no puede exceder 120 caracteres."),
  category: serviceCategorySchema,
  description: z.string().trim().max(2000, "Máximo 2000 caracteres.").optional(),
  durationMinutes: z.coerce
    .number({ invalid_type_error: "Escribe la duración en minutos." })
    .int("La duración debe ser en minutos completos.")
    .min(5, "La duración mínima es de 5 minutos.")
    .max(480, "La duración máxima es de 8 horas."),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(120).default(0),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(120).default(0),
  priceCents: precioPesosSchema,
  requiresVeterinarian: z.boolean().default(true),
  veterinarianMemberIds: z.array(uuidSchema).max(50).optional(),
});

export const updateServiceSchema = createServiceSchema
  .omit({ clinicId: true, veterinarianMemberIds: true })
  .extend({ active: z.boolean().default(true) });

export const scheduleSlotSchema = z
  .object({
    weekday: z.coerce
      .number()
      .int()
      .min(1, "Día inválido.")
      .max(7, "Día inválido (1=lunes … 7=domingo)."),
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .refine((s) => s.startTime < s.endTime, {
    message: "La hora de inicio debe ser anterior a la de fin.",
    path: ["endTime"],
  });

export const configureScheduleSchema = z.object({
  clinicId: uuidSchema,
  clinicMemberId: uuidSchema,
  slots: z.array(scheduleSlotSchema).max(40, "Máximo 40 ventanas."),
});

export const scheduleExceptionSchema = z
  .object({
    clinicId: uuidSchema,
    clinicMemberId: uuidSchema.optional(),
    type: scheduleExceptionTypeSchema,
    startsAt: localDateTimeSchema,
    endsAt: localDateTimeSchema,
    reason: z.string().trim().max(500, "Máximo 500 caracteres.").optional(),
  })
  .refine((e) => e.startsAt < e.endsAt, {
    message: "El inicio debe ser anterior al fin.",
    path: ["endsAt"],
  })
  .refine((e) => e.type !== "special_hours" || Boolean(e.clinicMemberId), {
    message: "Un horario especial requiere elegir a la persona.",
    path: ["clinicMemberId"],
  });

export const bookAppointmentSchema = z
  .object({
    clinicId: uuidSchema,
    petId: uuidSchema,
    ownerId: uuidSchema,
    veterinarianMemberId: uuidSchema,
    serviceIds: z
      .array(uuidSchema)
      .min(1, "Elige al menos un servicio.")
      .max(10, "Máximo 10 servicios por cita."),
    start: localDateTimeSchema,
    source: z.enum(["staff", "phone", "walk_in"], {
      errorMap: () => ({ message: "Origen de cita inválido." }),
    }),
    reason: z.string().trim().max(1000, "Máximo 1000 caracteres.").optional(),
    emergency: z.boolean().default(false),
    emergencyReason: z.string().trim().max(500, "Máximo 500 caracteres.").optional(),
    notes: z.string().trim().max(2000, "Máximo 2000 caracteres.").optional(),
  })
  .refine((c) => !c.emergency || Boolean(c.emergencyReason), {
    message: "Una urgencia requiere describir el motivo.",
    path: ["emergencyReason"],
  });

export const transitionAppointmentSchema = z.object({
  appointmentId: uuidSchema,
  newStatus: appointmentStatusSchema,
  reason: z.string().trim().max(500, "Máximo 500 caracteres.").optional(),
});

export const cancelAppointmentSchema = z.object({
  appointmentId: uuidSchema,
  reason: z
    .string({ required_error: "El motivo es obligatorio." })
    .trim()
    .min(3, "Describe el motivo de la cancelación.")
    .max(500, "Máximo 500 caracteres."),
});

export const rescheduleAppointmentSchema = z.object({
  appointmentId: uuidSchema,
  newStart: localDateTimeSchema,
  newVeterinarianMemberId: uuidSchema.optional(),
  reason: z.string().trim().max(500, "Máximo 500 caracteres.").optional(),
});

export const availabilityQuerySchema = z
  .object({
    clinicId: uuidSchema,
    veterinarianMemberId: uuidSchema,
    serviceId: uuidSchema,
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
  })
  .refine(
    (q) => {
      const dias =
        (new Date(`${q.toDate}T00:00:00Z`).getTime() -
          new Date(`${q.fromDate}T00:00:00Z`).getTime()) /
        86_400_000;
      return dias >= 0 && dias <= 31;
    },
    { message: "Consulta un rango de 1 a 31 días.", path: ["toDate"] },
  );

/** Folio de cita: CIT-AAAA-NNNNNN (secuencial por clínica y año). */
export const appointmentFolioSchema = z.string().regex(/^CIT-\d{4}-\d{6}$/, "Folio inválido.");
