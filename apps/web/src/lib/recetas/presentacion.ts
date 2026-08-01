import type { PrescriptionStatus } from "@dogtoralia/types";

/**
 * Ayudas de PRESENTACIÓN de recetas (solo UX; la autoridad de permisos y
 * estados es PostgreSQL).
 */

/** Variante de Badge por estado de receta. */
export function varianteEstadoReceta(
  estado: PrescriptionStatus,
): "success" | "destructive" | "warning" | "neutral" {
  if (estado === "issued") return "success";
  if (estado === "voided") return "destructive";
  if (estado === "superseded") return "neutral";
  return "warning"; // draft: borrador en preparación
}
