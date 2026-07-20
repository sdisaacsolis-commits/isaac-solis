import type {
  ClinicRole,
  ClinicStatus,
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
} from "@dogtoralia/types";

/**
 * Etiquetas es-MX y ayudas de PRESENTACIÓN para roles y estados.
 * Son solo UX: la autoridad de permisos es PostgreSQL (RLS). Ocultar un botón
 * aquí jamás sustituye a las políticas.
 */

export const etiquetasRolOrganizacion: Record<OrganizationRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  billing: "Facturación",
  member: "Miembro",
};

export const etiquetasRolClinica: Record<ClinicRole, string> = {
  clinic_admin: "Administrador de clínica",
  veterinarian: "Médico veterinario",
  receptionist: "Recepcionista",
  assistant: "Asistente",
};

export const etiquetasEstadoMembresia: Record<MembershipStatus, string> = {
  invited: "Invitación pendiente",
  active: "Activo",
  suspended: "Suspendido",
  removed: "Removido",
};

export const etiquetasEstadoClinica: Record<ClinicStatus, string> = {
  trial: "Periodo de prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  suspended: "Suspendida",
  cancelled: "Cancelada",
  archived: "Archivada",
};

export const etiquetasEstadoInvitacion: Record<InvitationStatus, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  expired: "Vencida",
  revoked: "Revocada",
};

/** ¿El rol de organización permite administrar (clínicas, personal, invitaciones)? */
export function puedeAdministrarOrganizacion(role: OrganizationRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** ¿El rol permite editar los datos de identidad de la organización? */
export function puedeEditarOrganizacion(role: OrganizationRole | null | undefined): boolean {
  return role === "owner";
}

/** ¿Puede administrar una clínica concreta (datos, personal, invitaciones)? */
export function puedeAdministrarClinica(
  orgRole: OrganizationRole | null | undefined,
  clinicRole: ClinicRole | null | undefined,
): boolean {
  return puedeAdministrarOrganizacion(orgRole) || clinicRole === "clinic_admin";
}
