/** Reglas de fotografías compartibles con pruebas (sin dependencias de servidor). */

export const PET_PHOTOS_BUCKET = "pet-photos";
export const MAX_PET_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

/** Formatos seguros. SVG queda excluido a propósito (riesgo XSS). */
export const ALLOWED_PET_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export function esFotoValida(meta: {
  size: number;
  type: string;
}): { ok: true } | { ok: false; error: string } {
  if (meta.size === 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (meta.size > MAX_PET_PHOTO_BYTES) {
    return { ok: false, error: "La fotografía no puede exceder 5 MB." };
  }
  if (!(ALLOWED_PET_PHOTO_MIME as readonly string[]).includes(meta.type)) {
    return { ok: false, error: "Formato no permitido: usa JPEG, PNG o WebP." };
  }
  return { ok: true };
}
