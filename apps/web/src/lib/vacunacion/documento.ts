import { z } from "zod";

/**
 * Esquema del comprobante CONGELADO de vacunación
 * (vaccination_documents.content, generado en SQL por record_vaccination). La
 * vista imprimible renderiza este snapshot cuando existe; los históricos sin
 * documento congelado se presentan desde el registro con su fuente etiquetada.
 */

const textoNulo = z.string().nullish();

export const contenidoVacunacionSchema = z.object({
  template_version: z.number().nullish(),
  record_id: textoNulo,
  source: textoNulo,
  vaccine_name: textoNulo,
  manufacturer: textoNulo,
  diseases: z.array(z.string()).nullish(),
  lot_number: textoNulo,
  expiration_date: textoNulo,
  administered_at: textoNulo,
  route_text: textoNulo,
  application_site: textoNulo,
  dose_text: textoNulo,
  next_due_at: textoNulo,
  pet: z
    .object({
      name: textoNulo,
      species: textoNulo,
      breed: textoNulo,
      sex: textoNulo,
      birth_date: textoNulo,
    })
    .nullish(),
  veterinarian: z
    .object({
      display_name: textoNulo,
      professional_license: textoNulo,
    })
    .nullish(),
  clinic: z
    .object({
      name: textoNulo,
      phone: textoNulo,
      city: textoNulo,
      state: textoNulo,
    })
    .nullish(),
});

export type ContenidoVacunacion = z.infer<typeof contenidoVacunacionSchema>;
