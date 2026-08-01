import type { VaccinationRecordStatus, VaccinationSource } from "@dogtoralia/types";

/**
 * Ayudas de PRESENTACIÓN de vacunación (solo UX; la autoridad de permisos y
 * estados es PostgreSQL).
 */

/** Variante de Badge por estado del registro. */
export function varianteEstadoVacunacion(
  estado: VaccinationRecordStatus,
): "success" | "destructive" {
  return estado === "voided" ? "destructive" : "success";
}

/**
 * Variante de Badge por fuente: la aplicación verificada en clínica se
 * distingue de los antecedentes aportados o de terceros.
 */
export function varianteFuenteVacunacion(
  fuente: VaccinationSource,
): "brand" | "neutral" | "warning" {
  if (fuente === "administered_in_clinic") return "brand";
  if (fuente === "historical_owner_document") return "warning";
  return "neutral"; // external_clinic, campaign, import
}
