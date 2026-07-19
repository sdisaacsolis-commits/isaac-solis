import type {
  ClinicPetStatus,
  ContactMethod,
  OwnerPetRelationshipType,
  PetAlertSeverity,
  PetAlertType,
  PetSex,
  PetSpecies,
} from "@dogtoralia/types";

/** Etiquetas es-MX del dominio de pacientes (solo presentación). */

export const etiquetasEspecie: Record<PetSpecies, string> = {
  dog: "Perro",
  cat: "Gato",
  other: "Otra especie",
};

export const etiquetasSexo: Record<PetSex, string> = {
  male: "Macho",
  female: "Hembra",
  unknown: "Sin determinar",
};

export const etiquetasRelacionPropietario: Record<OwnerPetRelationshipType, string> = {
  owner: "Propietario",
  guardian: "Tutor",
  family_member: "Familiar",
  temporary_caregiver: "Cuidador temporal",
  other: "Otro",
};

export const etiquetasTipoAlerta: Record<PetAlertType, string> = {
  aggressive_behavior: "Comportamiento agresivo",
  escape_risk: "Riesgo de fuga",
  handling_precaution: "Precaución de manejo",
  communication_preference: "Preferencia de comunicación",
  billing_note: "Nota de cobranza",
  other: "Otra",
};

export const etiquetasSeveridadAlerta: Record<PetAlertSeverity, string> = {
  info: "Informativa",
  caution: "Precaución",
  critical: "Crítica",
};

export const etiquetasEstadoRelacionClinica: Record<ClinicPetStatus, string> = {
  active: "Activa",
  inactive: "Inactiva",
  transferred: "Transferida",
  blocked: "Bloqueada",
  archived: "Archivada",
};

export const etiquetasMedioContacto: Record<ContactMethod, string> = {
  phone: "Teléfono",
  email: "Correo",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

/** Nombre visible del propietario. */
export function nombrePropietario(owner: {
  display_name?: string | null;
  first_name: string;
  last_name: string;
}): string {
  return owner.display_name?.trim() || `${owner.first_name} ${owner.last_name}`.trim();
}

/**
 * Edad calculada desde la fecha de nacimiento (NUNCA almacenada).
 * `hoy` es inyectable para pruebas deterministas.
 */
export function calcularEdad(
  birthDate: string | null,
  aproximada: boolean,
  hoy: Date = new Date(),
): string | null {
  if (!birthDate) return null;
  const nacimiento = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(nacimiento.getTime())) return null;

  let meses =
    (hoy.getUTCFullYear() - nacimiento.getUTCFullYear()) * 12 +
    (hoy.getUTCMonth() - nacimiento.getUTCMonth());
  if (hoy.getUTCDate() < nacimiento.getUTCDate()) meses -= 1;
  if (meses < 0) return null;

  const prefijo = aproximada ? "aprox. " : "";
  if (meses < 1) return `${prefijo}menos de un mes`;
  if (meses < 12) return `${prefijo}${meses} ${meses === 1 ? "mes" : "meses"}`;

  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const base = `${anios} ${anios === 1 ? "año" : "años"}`;
  if (anios < 5 && resto > 0) {
    return `${prefijo}${base} ${resto} ${resto === 1 ? "mes" : "meses"}`;
  }
  return `${prefijo}${base}`;
}

/** Escapa comodines de LIKE/ILIKE para búsquedas parametrizadas. */
export function escaparBusqueda(termino: string): string {
  return termino.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/,/g, " ");
}
