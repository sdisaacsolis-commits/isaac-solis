import { DIAGNOSIS_CERTAINTIES, ENCOUNTER_TYPES, TREATMENT_TYPES } from "@dogtoralia/types";
import { z } from "zod";

/**
 * Esquemas del expediente clínico (Fase 6). Texto plano siempre (la UI
 * renderiza con whitespace-pre-line: sin HTML ni contenido ejecutable).
 * Rangos FÍSICAMENTE posibles; los CHECK de la base son la autoridad final.
 */

const uuidSchema = z.string().uuid("Identificador inválido.");
const textoCorto = (max: number) =>
  z.string().trim().max(max, `No puede exceder ${max} caracteres.`).optional();

const numeroOpcional = (min: number, max: number, mensaje: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number({ invalid_type_error: mensaje }).min(min, mensaje).max(max, mensaje).optional(),
  );

export const encounterVersionSchema = z.coerce
  .number({ invalid_type_error: "Versión inválida." })
  .int()
  .min(1, "Versión inválida.");

export const startEncounterSchema = z.object({ appointmentId: uuidSchema });

export const walkInEncounterSchema = z.object({
  clinicId: uuidSchema,
  petId: uuidSchema,
  ownerId: uuidSchema,
  veterinarianMemberId: uuidSchema,
  serviceIds: z.array(uuidSchema).min(1, "Elige al menos un servicio.").max(10),
  encounterType: z.enum(["walk_in", "emergency"], {
    errorMap: () => ({ message: "Tipo inválido." }),
  }),
  chiefComplaint: textoCorto(1000),
  emergencyReason: textoCorto(500),
});

export const encounterHeaderSchema = z.object({
  encounterId: uuidSchema,
  chiefComplaint: textoCorto(1000),
  vitalsSkippedReason: textoCorto(300),
  examinationSkippedReason: textoCorto(300),
  internalNotes: textoCorto(2000),
});

export const soapNoteSchema = z.object({
  encounterId: uuidSchema,
  expectedVersion: encounterVersionSchema.optional(),
  historySummary: textoCorto(4000),
  subjective: textoCorto(8000),
  objective: textoCorto(8000),
  assessment: textoCorto(8000),
  plan: textoCorto(8000),
});

export const vitalsSchema = z.object({
  encounterId: uuidSchema,
  weightKg: numeroOpcional(0.001, 500, "Peso inválido (0–500 kg)."),
  temperatureC: numeroOpcional(25, 45, "Temperatura físicamente imposible (25–45 °C)."),
  heartRateBpm: numeroOpcional(1, 500, "Frecuencia cardiaca inválida."),
  respiratoryRateBpm: numeroOpcional(1, 300, "Frecuencia respiratoria inválida."),
  capillaryRefillSeconds: numeroOpcional(0, 30, "Llenado capilar inválido."),
  bodyConditionScore: numeroOpcional(1, 9, "Condición corporal: escala 1–9."),
  painScore: numeroOpcional(0, 10, "Dolor: escala 0–10."),
  hydrationStatus: textoCorto(200),
  mucousMembranes: textoCorto(200),
  bloodPressureSystolic: numeroOpcional(20, 400, "Presión sistólica inválida."),
  bloodPressureDiastolic: numeroOpcional(10, 300, "Presión diastólica inválida."),
  notes: textoCorto(1000),
});

export const examinationSchema = z.object({
  encounterId: uuidSchema,
  expectedVersion: encounterVersionSchema.optional(),
  generalCondition: textoCorto(500),
  attitude: textoCorto(500),
  bodyCondition: textoCorto(500),
  skinAndCoat: textoCorto(500),
  eyes: textoCorto(500),
  ears: textoCorto(500),
  oralCavity: textoCorto(500),
  cardiovascular: textoCorto(500),
  respiratory: textoCorto(500),
  digestive: textoCorto(500),
  urinary: textoCorto(500),
  musculoskeletal: textoCorto(500),
  neurological: textoCorto(500),
  lymphNodes: textoCorto(500),
  observations: textoCorto(4000),
});

export const diagnosisSchema = z.object({
  encounterId: uuidSchema,
  name: z
    .string({ required_error: "El diagnóstico es obligatorio." })
    .trim()
    .min(2, "Describe el diagnóstico.")
    .max(300),
  description: textoCorto(2000),
  certainty: z.enum(DIAGNOSIS_CERTAINTIES, {
    errorMap: () => ({ message: "Certeza inválida." }),
  }),
  isPrimary: z.boolean().default(false),
});

export const treatmentSchema = z.object({
  encounterId: uuidSchema,
  treatmentType: z.enum(TREATMENT_TYPES, { errorMap: () => ({ message: "Tipo inválido." }) }),
  name: z
    .string({ required_error: "El tratamiento es obligatorio." })
    .trim()
    .min(2, "Describe el tratamiento.")
    .max(300),
  instructions: textoCorto(4000),
  dosageText: textoCorto(300),
  routeText: textoCorto(100),
  frequencyText: textoCorto(200),
  durationText: textoCorto(200),
  performedDuringEncounter: z.boolean().default(false),
});

export const followUpSchema = z.object({
  encounterId: uuidSchema,
  reason: z
    .string({ required_error: "El motivo del seguimiento es obligatorio." })
    .trim()
    .min(2, "Describe el seguimiento.")
    .max(1000),
  recommendedWithinDays: numeroOpcional(1, 365, "Entre 1 y 365 días."),
  serviceId: uuidSchema.optional(),
});

export const CLINICAL_FILE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const clinicalFileSchema = z.object({
  encounterId: uuidSchema,
  kind: z.enum(
    ["laboratory_result", "image", "external_prescription", "referral", "consent", "other"],
    { errorMap: () => ({ message: "Tipo de archivo inválido." }) },
  ),
  description: textoCorto(500),
});

export const addendumSchema = z.object({
  encounterId: uuidSchema,
  content: z
    .string({ required_error: "La adenda es obligatoria." })
    .trim()
    .min(2, "Escribe el contenido de la adenda.")
    .max(8000),
  reason: z
    .string({ required_error: "El motivo es obligatorio." })
    .trim()
    .min(2, "Escribe el motivo de la adenda.")
    .max(500),
});

export const voidEncounterSchema = z.object({
  encounterId: uuidSchema,
  reason: z
    .string({ required_error: "El motivo es obligatorio." })
    .trim()
    .min(3, "Describe el motivo de la anulación.")
    .max(500),
});

export const encounterTypeSchema = z.enum(ENCOUNTER_TYPES);
