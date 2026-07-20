import { z } from "zod";

/**
 * Esquemas de recetas (Fase 7). Todo el contenido clínico (dosis, vía,
 * frecuencia, duración) es TEXTO capturado por el veterinario: aquí solo se
 * valida estructura, longitud y obligatoriedad — jamás decisiones clínicas
 * que Dogtoralia no puede determinar. La autoridad final es PostgreSQL.
 */

const uuidSchema = z.string().uuid("Identificador inválido.");
const textoCorto = (max: number) =>
  z.string().trim().max(max, `No puede exceder ${max} caracteres.`).optional();
const textoObligatorio = (campo: string, max: number) =>
  z
    .string({ required_error: `${campo} es obligatorio.` })
    .trim()
    .min(1, `${campo} es obligatorio.`)
    .max(max, `No puede exceder ${max} caracteres.`);

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD).")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Fecha inválida.");

export const prescriptionVersionSchema = z.coerce
  .number({ invalid_type_error: "Versión inválida." })
  .int()
  .min(1, "Versión inválida.");

export const createPrescriptionDraftSchema = z.object({
  encounterId: uuidSchema,
});

export const updatePrescriptionDraftSchema = z.object({
  prescriptionId: uuidSchema,
  expectedVersion: prescriptionVersionSchema,
  generalInstructions: textoCorto(2000),
  clinicalIndication: textoCorto(1000),
  validUntil: fechaISO.optional(),
});

export const prescriptionItemSchema = z
  .object({
    prescriptionId: uuidSchema,
    itemId: uuidSchema.optional(), // presente al editar una partida existente
    position: z.coerce
      .number({ invalid_type_error: "Orden inválido." })
      .int()
      .min(1, "Orden inválido.")
      .max(200, "Orden inválido."),
    medicationName: textoObligatorio("El medicamento", 200),
    activeIngredient: textoCorto(200),
    presentation: textoCorto(200),
    concentration: textoCorto(100),
    dosageText: textoObligatorio("La dosis", 300),
    routeText: textoObligatorio("La vía de administración", 100),
    frequencyText: textoObligatorio("La frecuencia", 200),
    durationText: textoObligatorio("La duración", 200),
    quantityText: textoCorto(100),
    instructions: textoCorto(1000),
    startDate: fechaISO.optional(),
    endDate: fechaISO.optional(),
    asNeeded: z.boolean().default(false),
    notes: textoCorto(500),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "El fin del tratamiento no puede ser anterior al inicio.",
    path: ["endDate"],
  });

export const removePrescriptionItemSchema = z.object({
  prescriptionId: uuidSchema,
  itemId: uuidSchema,
});

export const issuePrescriptionSchema = z.object({
  prescriptionId: uuidSchema,
  // Confirmación explícita en la UI: emitir congela el documento.
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Confirma la emisión de la receta." }),
  }),
});

export const supersedePrescriptionSchema = z.object({
  prescriptionId: uuidSchema,
  reason: z
    .string({ required_error: "El motivo es obligatorio." })
    .trim()
    .min(3, "Describe el motivo de la sustitución.")
    .max(500, "No puede exceder 500 caracteres."),
});

export const voidPrescriptionSchema = z.object({
  prescriptionId: uuidSchema,
  reason: z
    .string({ required_error: "El motivo es obligatorio." })
    .trim()
    .min(3, "Describe el motivo de la anulación.")
    .max(500, "No puede exceder 500 caracteres."),
});

export const discardPrescriptionDraftSchema = z.object({
  prescriptionId: uuidSchema,
});

export const prescriptionFiltersSchema = z.object({
  estado: z.enum(["draft", "issued", "superseded", "voided"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
