/**
 * Interfaz desacoplada de mensajería (ARCHITECTURE.md §6.1), canal correo.
 * El dominio nunca importa SDKs de proveedores: solo este contrato.
 */
export interface InvitationEmailInput {
  to: string;
  clinicName: string;
  roleLabel: string;
  /** Enlace de aceptación con el token de un solo uso. NUNCA se registra completo. */
  acceptUrl: string;
  /** Vencimiento ya formateado en es-MX (zona America/Mexico_City). */
  expiresAtText: string;
  /** Nombre opcional SOLO para personalizar el saludo; no es identidad oficial. */
  inviteeName?: string;
  invitedByName?: string;
}

export type EmailSendResult = { sent: true; providerId?: string } | { sent: false; reason: string };

export interface EmailProvider {
  readonly name: string;
  sendInvitation(input: InvitationEmailInput): Promise<EmailSendResult>;
}
