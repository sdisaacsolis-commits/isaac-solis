import { safeInternalPathSchema } from "@dogtoralia/validation";

export const DESTINO_POR_DEFECTO = "/app/inicio";
export const DESTINO_ONBOARDING = "/app/onboarding";

/**
 * Resuelve el parámetro `next` a un destino seguro: solo rutas relativas de
 * esta aplicación. Cualquier valor manipulado (host externo, esquema,
 * backslash) cae al destino por defecto — evita open redirects.
 */
export function resolveSafeNext(next: string | null | undefined, fallback = DESTINO_POR_DEFECTO) {
  if (!next) return fallback;
  const parsed = safeInternalPathSchema.safeParse(next);
  return parsed.success ? parsed.data : fallback;
}
