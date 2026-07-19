/**
 * Registro operativo del backend (Server Actions / route handlers).
 *
 * Distinción documentada en docs/security/rls-model.md: los eventos de negocio
 * (organización creada, invitación creada/aceptada/revocada, cambios de rol)
 * quedan en `audit_log` vía triggers de base de datos; aquí solo se registran
 * eventos OPERATIVOS (envío de correo, fallos de proveedor) sin datos sensibles.
 *
 * PROHIBIDO registrar: contraseñas, tokens, cookies, llaves o headers completos.
 */

const TOKEN_EN_URL = /(\/invitaciones\/)[0-9a-f]{64}/gi;
const HEX_LARGO = /\b[0-9a-f]{64}\b/gi;

/** Redacta tokens de invitación dejando solo los últimos 4 caracteres. */
export function redactSensitive(text: string): string {
  return text
    .replace(TOKEN_EN_URL, (match, prefix: string) => `${prefix}…${match.slice(-4)}`)
    .replace(HEX_LARGO, (match) => `…${match.slice(-4)}`);
}

export function logOperational(event: string, data: Record<string, string | number | boolean>) {
  const safeEntries = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "string" ? redactSensitive(value) : value,
    ]),
  );
  console.warn(JSON.stringify({ scope: "dogtoralia.operational", event, ...safeEntries }));
}
