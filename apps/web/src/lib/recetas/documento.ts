import { z } from "zod";

/**
 * Esquema del documento CONGELADO de la receta (prescription_documents.content,
 * generado en SQL por issue_prescription). La vista imprimible renderiza
 * EXCLUSIVAMENTE este snapshot; jamás datos vivos. El esquema es tolerante
 * (campos anulables) porque el snapshot refleja lo que existía al emitir.
 */

const textoNulo = z.string().nullish();

export const contenidoRecetaSchema = z.object({
  template_version: z.number().nullish(),
  folio: textoNulo,
  issued_at: textoNulo,
  valid_until: textoNulo,
  clinic: z
    .object({
      name: textoNulo,
      phone: textoNulo,
      email: textoNulo,
      address_line_1: textoNulo,
      address_line_2: textoNulo,
      neighborhood: textoNulo,
      city: textoNulo,
      state: textoNulo,
      postal_code: textoNulo,
      timezone: textoNulo,
    })
    .nullish(),
  prescriber: z
    .object({
      display_name: textoNulo,
      professional_license: textoNulo,
      job_title: textoNulo,
    })
    .nullish(),
  pet: z
    .object({
      name: textoNulo,
      species: textoNulo,
      breed: textoNulo,
      sex: textoNulo,
      birth_date: textoNulo,
      color: textoNulo,
      microchip_number: textoNulo,
      weight_kg: z.union([z.number(), z.string()]).nullish(),
    })
    .nullish(),
  owner: z
    .object({
      display_name: textoNulo,
      email: textoNulo,
      phone: textoNulo,
    })
    .nullish(),
  items: z
    .array(
      z.object({
        position: z.number().nullish(),
        medication_name: textoNulo,
        active_ingredient: textoNulo,
        presentation: textoNulo,
        concentration: textoNulo,
        dosage_text: textoNulo,
        route_text: textoNulo,
        frequency_text: textoNulo,
        duration_text: textoNulo,
        quantity_text: textoNulo,
        instructions: textoNulo,
        start_date: textoNulo,
        end_date: textoNulo,
        as_needed: z.boolean().nullish(),
        notes: textoNulo,
      }),
    )
    .nullish(),
  general_instructions: textoNulo,
  clinical_indication: textoNulo,
  supersedes_folio: textoNulo,
});

export type ContenidoReceta = z.infer<typeof contenidoRecetaSchema>;
