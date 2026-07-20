import "server-only";

import { env } from "@/env";

import { createDevEmailProvider } from "./dev-provider";
import { createResendEmailProvider } from "./resend-provider";
import type { EmailProvider } from "./types";

/**
 * Selección de proveedor por configuración:
 * - EMAIL_MODE=resend + credenciales completas → Resend (correo real).
 * - Cualquier otro caso → adaptador de desarrollo (registra redactado, no envía).
 * La aplicación nunca se rompe por falta de configuración de correo.
 */
export function getEmailProvider(): EmailProvider {
  if (env.EMAIL_MODE === "resend" && env.RESEND_API_KEY && env.EMAIL_FROM) {
    return createResendEmailProvider({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
    });
  }
  return createDevEmailProvider();
}
