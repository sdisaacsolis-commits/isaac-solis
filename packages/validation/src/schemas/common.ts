import { z } from "zod";

/**
 * Esquemas de validación transversales.
 *
 * Regla (CLAUDE.md §8): todo dato externo se valida con Zod en la frontera con estos
 * esquemas; no se duplican reglas en las apps. Los mensajes de error son en español de
 * México y aptos para mostrarse al usuario.
 */

/** Correo electrónico normalizado a minúsculas. */
export const emailSchema = z
  .string({ required_error: "El correo electrónico es obligatorio." })
  .trim()
  .toLowerCase()
  .email("Ingresa un correo electrónico válido.");

/**
 * Teléfono mexicano en formato E.164 (+52 seguido de 10 dígitos).
 * Acepta espacios, guiones y paréntesis de captura, que se eliminan al normalizar.
 */
export const phoneMxSchema = z
  .string({ required_error: "El teléfono es obligatorio." })
  .transform((value) => value.replace(/[\s\-().]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\+52\d{10}$/, "Ingresa un teléfono válido en formato +52 seguido de 10 dígitos."),
  );

/** Texto obligatorio sin espacios sobrantes (nombres, razones sociales, etc.). */
export const nonEmptyTextSchema = z
  .string({ required_error: "Este campo es obligatorio." })
  .trim()
  .min(1, "Este campo es obligatorio.")
  .max(200, "Este campo no puede exceder 200 caracteres.");

/**
 * Slug para perfiles públicos futuros (/clinicas/[slug], /veterinarios/[slug]).
 * Minúsculas, números y guiones; sin guiones al inicio/final ni consecutivos.
 */
export const clinicSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "El slug solo puede contener minúsculas, números y guiones simples.",
  )
  .min(3, "El slug debe tener al menos 3 caracteres.")
  .max(60, "El slug no puede exceder 60 caracteres.");
