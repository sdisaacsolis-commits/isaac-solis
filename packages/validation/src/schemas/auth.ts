import { z } from "zod";

import { emailSchema } from "./common";

/**
 * Esquemas de autenticación (Fase 3).
 *
 * Reglas de contraseña (documentadas en docs/auth/authentication-flow.md):
 * 8–72 caracteres (límite de bcrypt), al menos una letra y un número. Sin
 * exigencias de símbolos que fomenten contraseñas débiles reutilizadas.
 */
export const passwordSchema = z
  .string({ required_error: "La contraseña es obligatoria." })
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede exceder 72 caracteres.")
  .regex(/[a-zá-úñ]/i, "La contraseña debe incluir al menos una letra.")
  .regex(/[0-9]/, "La contraseña debe incluir al menos un número.");

const nameSchema = z
  .string({ required_error: "Este campo es obligatorio." })
  .trim()
  .min(1, "Este campo es obligatorio.")
  .max(100, "No puede exceder 100 caracteres.");

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: "Confirma tu contraseña." }),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar los términos y el aviso de privacidad." }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "La contraseña es obligatoria." })
    .min(1, "La contraseña es obligatoria."),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string({ required_error: "Confirma tu contraseña." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

/** Token de invitación tal como viaja en el enlace: 64 caracteres hexadecimales. */
export const invitationTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "El enlace de invitación no es válido.");

/**
 * Ruta interna segura para redirecciones post-autenticación.
 * Solo rutas relativas de esta app: deben iniciar con "/" y se rechazan
 * "//host", esquemas ("https:"), y backslashes — evita open redirects.
 */
export const safeInternalPathSchema = z
  .string()
  .max(500)
  .regex(/^\/(?!\/)[^\\]*$/, "Ruta de redirección inválida.")
  .refine((value) => !value.includes(":"), "Ruta de redirección inválida.");
