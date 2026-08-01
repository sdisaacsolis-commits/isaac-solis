import { z } from "zod";

/**
 * Esquemas de reseñas verificadas (Fase 8.1). La verificación (que el autor
 * asistió a la cita) es estructural en la base; aquí se valida forma y
 * obligatoriedad. La autoridad final es PostgreSQL (RPCs SECURITY DEFINER).
 */

const uuidSchema = z.string().uuid("Identificador inválido.");

const ratingSchema = z.coerce
  .number({ invalid_type_error: "Elige de 1 a 5 estrellas." })
  .int("Elige de 1 a 5 estrellas.")
  .min(1, "Elige de 1 a 5 estrellas.")
  .max(5, "Elige de 1 a 5 estrellas.");

export const submitReviewSchema = z.object({
  appointmentId: uuidSchema,
  rating: ratingSchema,
  title: z.string().trim().max(120, "No puede exceder 120 caracteres.").optional(),
  body: z
    .string({ required_error: "Escribe tu opinión." })
    .trim()
    .min(3, "Escribe tu opinión (mínimo 3 caracteres).")
    .max(2000, "No puede exceder 2000 caracteres."),
});

export const updateMyReviewSchema = submitReviewSchema
  .omit({ appointmentId: true })
  .extend({ reviewId: uuidSchema });

export const replyToReviewSchema = z.object({
  reviewId: uuidSchema,
  reply: z
    .string({ required_error: "Escribe la respuesta." })
    .trim()
    .min(1, "Escribe la respuesta.")
    .max(2000, "No puede exceder 2000 caracteres."),
});

export const reportReviewSchema = z.object({
  reviewId: uuidSchema,
  reason: z
    .string({ required_error: "Indica el motivo del reporte." })
    .trim()
    .min(3, "Describe el motivo del reporte.")
    .max(500, "No puede exceder 500 caracteres."),
});

export const moderateReviewSchema = z.object({
  reviewId: uuidSchema,
  hidden: z.boolean(),
  reason: z
    .string({ required_error: "La moderación requiere motivo." })
    .trim()
    .min(3, "Describe el motivo de la moderación.")
    .max(500, "No puede exceder 500 caracteres."),
});
