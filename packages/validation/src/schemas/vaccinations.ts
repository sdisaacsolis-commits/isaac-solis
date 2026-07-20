import { HISTORICAL_VACCINATION_SOURCES, PET_SPECIES } from "@dogtoralia/types";
import { z } from "zod";

/**
 * Esquemas de vacunación (Fase 7). Se valida estructura, fechas y campos
 * obligatorios (lote/caducidad para aplicaciones en clínica); las decisiones
 * clínicas (qué vacuna, cuándo la próxima dosis) son del veterinario y la
 * autoridad final es PostgreSQL.
 */

const uuidSchema = z.string().uuid("Identificador inválido.");
const textoCorto = (max: number) =>
  z.string().trim().max(max, `No puede exceder ${max} caracteres.`).optional();

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD).")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Fecha inválida.");

const listaTexto = (max: number) =>
  z
    .array(z.string().trim().min(1).max(120))
    .max(max, `Máximo ${max} elementos.`)
    .optional();

export const vaccineCatalogSchema = z.object({
  catalogId: uuidSchema.optional(), // presente al editar
  name: z
    .string({ required_error: "El nombre de la vacuna es obligatorio." })
    .trim()
    .min(1, "El nombre de la vacuna es obligatorio.")
    .max(150, "No puede exceder 150 caracteres."),
  manufacturer: textoCorto(150),
  targetSpecies: z.array(z.enum(PET_SPECIES)).max(PET_SPECIES.length).default([]),
  diseasesCovered: listaTexto(20),
  presentation: textoCorto(150),
  // Ayuda editable, jamás decisión automática: el veterinario siempre
  // confirma la próxima dosis.
  defaultBoosterIntervalDays: z.coerce
    .number({ invalid_type_error: "Intervalo inválido." })
    .int()
    .min(1, "Intervalo inválido.")
    .max(3650, "Intervalo inválido.")
    .optional(),
  active: z.boolean().default(true),
});

export const recordVaccinationSchema = z
  .object({
    clinicId: uuidSchema,
    petId: uuidSchema,
    encounterId: uuidSchema.optional(),
    vaccineCatalogId: uuidSchema.optional(),
    vaccineName: textoCorto(150),
    manufacturer: textoCorto(150),
    diseases: listaTexto(20),
    lotNumber: textoCorto(80),
    lotMissingReason: textoCorto(300),
    expirationDate: fechaISO.optional(),
    routeText: textoCorto(100),
    applicationSite: textoCorto(150),
    doseText: textoCorto(150),
    nextDueAt: fechaISO.optional(),
    notes: textoCorto(1000),
    requestId: uuidSchema,
  })
  .refine((v) => Boolean(v.vaccineCatalogId) || Boolean(v.vaccineName), {
    message: "Elige un producto del catálogo o captura su nombre.",
    path: ["vaccineName"],
  })
  .refine((v) => Boolean(v.lotNumber) || Boolean(v.lotMissingReason), {
    message: "Captura el lote o justifica su ausencia.",
    path: ["lotNumber"],
  })
  .refine((v) => !v.lotNumber || Boolean(v.expirationDate), {
    message: "Captura la caducidad del lote.",
    path: ["expirationDate"],
  });

export const recordHistoricalVaccinationSchema = z
  .object({
    clinicId: uuidSchema,
    petId: uuidSchema,
    source: z.enum(HISTORICAL_VACCINATION_SOURCES, {
      errorMap: () => ({ message: "Fuente inválida para un registro histórico." }),
    }),
    vaccineName: z
      .string({ required_error: "El nombre de la vacuna es obligatorio." })
      .trim()
      .min(1, "El nombre de la vacuna es obligatorio.")
      .max(150, "No puede exceder 150 caracteres."),
    administeredOn: fechaISO,
    manufacturer: textoCorto(150),
    diseases: listaTexto(20),
    lotNumber: textoCorto(80),
    expirationDate: fechaISO.optional(),
    nextDueAt: fechaISO.optional(),
    providerName: textoCorto(200),
    documentReference: textoCorto(300),
    notes: textoCorto(1000),
    requestId: uuidSchema,
  })
  .refine((v) => !v.nextDueAt || v.nextDueAt > v.administeredOn, {
    message: "La próxima dosis debe ser posterior a la aplicación.",
    path: ["nextDueAt"],
  });

export const voidVaccinationSchema = z.object({
  recordId: uuidSchema,
  reason: z
    .string({ required_error: "El motivo es obligatorio." })
    .trim()
    .min(3, "Describe el motivo de la anulación.")
    .max(500, "No puede exceder 500 caracteres."),
});

export const VACCINATION_FILE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const vaccinationFiltersSchema = z.object({
  estado: z.enum(["recorded", "voided"]).optional(),
  fuente: z
    .enum([
      "administered_in_clinic",
      "historical_owner_document",
      "external_clinic",
      "campaign",
      "import",
    ])
    .optional(),
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  vacuna: z.string().trim().max(150).optional(),
  proximas: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
});
