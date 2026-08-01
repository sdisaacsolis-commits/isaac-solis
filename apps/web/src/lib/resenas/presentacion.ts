import type { Enums } from "@dogtoralia/types";

import { mensajes } from "@/lib/i18n/es-mx";

type ReviewStatus = Enums<"review_status">;

/**
 * Ayudas de PRESENTACIÓN para la moderación de reseñas. Solo UX: la autoridad
 * de permisos y de estado es PostgreSQL (RLS + RPCs). Ocultar un botón aquí
 * jamás sustituye a las políticas.
 */

const t = mensajes.resenas.panel;

export function etiquetaEstadoResena(status: ReviewStatus): string {
  return t.estados[status] ?? status;
}

/** Variante de Badge para el estado de la reseña. */
export function varianteEstadoResena(status: ReviewStatus): "success" | "warning" {
  return status === "published" ? "success" : "warning";
}
