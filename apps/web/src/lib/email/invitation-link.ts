import { invitationTokenSchema } from "@dogtoralia/validation";

/**
 * Construye el enlace de aceptación a partir del token de un solo uso.
 * Valida el formato del token antes de interpolarlo (defensa ante valores
 * inesperados) y normaliza la URL base.
 */
export function buildInvitationUrl(appUrl: string, token: string): string {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) {
    throw new Error("Token de invitación con formato inválido.");
  }
  return `${appUrl.replace(/\/+$/, "")}/invitaciones/${parsed.data}`;
}

/** Formatea el vencimiento (7 días) en es-MX, zona America/Mexico_City. */
export function formatearVencimiento(fecha: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(fecha);
}
