import type { EncounterStatus } from "@dogtoralia/types";

/**
 * Ayudas de PRESENTACIÓN del expediente clínico (solo UX; la autoridad de
 * permisos y estados es PostgreSQL).
 */

/** Variante de Badge por estado de consulta. */
export function varianteEstadoConsulta(
  estado: EncounterStatus,
): "success" | "destructive" | "warning" {
  if (estado === "finalized") return "success";
  if (estado === "voided") return "destructive";
  return "warning"; // in_progress: borrador abierto
}
