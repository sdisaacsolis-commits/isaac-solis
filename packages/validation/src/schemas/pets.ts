import {
  CONTACT_METHODS,
  OWNER_PET_RELATIONSHIP_TYPES,
  PET_ALERT_SEVERITIES,
  PET_ALERT_TYPES,
  PET_SEXES,
  PET_SPECIES,
} from "@dogtoralia/types";
import { z } from "zod";

import { emailSchema, phoneMxSchema } from "./common";
import { postalCodeMxSchema } from "./tenancy";

/**
 * Esquemas del dominio de pacientes (Fase 4). Mensajes es-MX. Los enums se
 * derivan de la base de datos vía @dogtoralia/types — sin literales duplicados.
 * Validaciones deliberadamente NO restrictivas para nombres, razas y
 * direcciones (mundo real: acentos, apellidos compuestos, razas mixtas).
 */

const nombrePersona = z
  .string({ required_error: "Este campo es obligatorio." })
  .trim()
  .min(1, "Este campo es obligatorio.")
  .max(100, "No puede exceder 100 caracteres.");

const textoOpcional = (max: number) =>
  z.string().trim().max(max, `No puede exceder ${max} caracteres.`).optional();

export const petSpeciesSchema = z.enum(PET_SPECIES, {
  errorMap: () => ({ message: "Selecciona una especie válida." }),
});

export const petSexSchema = z.enum(PET_SEXES, {
  errorMap: () => ({ message: "Selecciona un sexo válido." }),
});

/** Microchip: normaliza (mayúsculas, sin espacios/guiones) y valida 5-25 alfanum. */
export const microchipSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]{5,25}$/, "El microchip debe tener de 5 a 25 caracteres alfanuméricos."),
  );

/** Fecha de nacimiento: no futura y posterior a 1980 (coherencia). */
export const petBirthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD.")
  .refine((value) => {
    const fecha = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(fecha.getTime()) && fecha <= new Date() && value >= "1980-01-01";
  }, "La fecha de nacimiento no es válida (no puede ser futura ni anterior a 1980).");

export const createOwnerSchema = z.object({
  firstName: nombrePersona,
  lastName: nombrePersona,
  email: emailSchema.optional(),
  phone: phoneMxSchema.optional(),
  secondaryPhone: phoneMxSchema.optional(),
  preferredContactMethod: z
    .enum(CONTACT_METHODS, {
      errorMap: () => ({ message: "Selecciona un medio de contacto válido." }),
    })
    .default("phone"),
  addressLine1: textoOpcional(200),
  addressLine2: textoOpcional(200),
  neighborhood: textoOpcional(120),
  city: textoOpcional(120),
  state: textoOpcional(120),
  postalCode: postalCodeMxSchema.optional(),
  administrativeNotes: textoOpcional(2000),
  internalCustomerNumber: textoOpcional(30),
  /** true cuando la persona confirmó crear pese a posibles duplicados. */
  confirmDuplicates: z.coerce.boolean().default(false),
});

export const updateOwnerSchema = createOwnerSchema
  .omit({ administrativeNotes: true, internalCustomerNumber: true, confirmDuplicates: true })
  .partial()
  .extend({ firstName: nombrePersona, lastName: nombrePersona });

export const createPetSchema = z.object({
  ownerId: z.string().uuid("Selecciona un propietario válido."),
  name: z
    .string({ required_error: "El nombre de la mascota es obligatorio." })
    .trim()
    .min(1, "El nombre de la mascota es obligatorio.")
    .max(100, "El nombre no puede exceder 100 caracteres."),
  species: petSpeciesSchema,
  breed: textoOpcional(100),
  sex: petSexSchema.default("unknown"),
  birthDate: petBirthDateSchema.optional(),
  approximateBirthDate: z.coerce.boolean().default(false),
  color: textoOpcional(100),
  identifyingMarks: textoOpcional(500),
  microchipNumber: microchipSchema.optional(),
  sterilized: z
    .enum(["si", "no", "desconocido"], {
      errorMap: () => ({ message: "Indica si está esterilizada." }),
    })
    .default("desconocido"),
  internalPatientNumber: textoOpcional(30),
  relationshipType: z
    .enum(OWNER_PET_RELATIONSHIP_TYPES, {
      errorMap: () => ({ message: "Selecciona un tipo de relación válido." }),
    })
    .default("owner"),
  confirmDuplicates: z.coerce.boolean().default(false),
});

export const updatePetSchema = createPetSchema
  .omit({
    ownerId: true,
    internalPatientNumber: true,
    relationshipType: true,
    confirmDuplicates: true,
  })
  .partial()
  .extend({
    name: z.string().trim().min(1, "El nombre de la mascota es obligatorio.").max(100),
  });

export const petAlertSchema = z.object({
  petId: z.string().uuid("Mascota inválida."),
  type: z.enum(PET_ALERT_TYPES, {
    errorMap: () => ({ message: "Selecciona un tipo de alerta válido." }),
  }),
  severity: z
    .enum(PET_ALERT_SEVERITIES, {
      errorMap: () => ({ message: "Selecciona una severidad válida." }),
    })
    .default("caution"),
  title: z
    .string({ required_error: "El título es obligatorio." })
    .trim()
    .min(1, "El título es obligatorio.")
    .max(120, "El título no puede exceder 120 caracteres."),
  description: textoOpcional(1000),
});

/** Búsqueda en clínica: término corto, paginación acotada. */
export const clinicSearchSchema = z.object({
  q: z.string().trim().min(2, "Escribe al menos 2 caracteres.").max(80).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  species: petSpeciesSchema.optional(),
  sex: petSexSchema.optional(),
});
