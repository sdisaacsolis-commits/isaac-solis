import "server-only";

import { asuntoInvitacion, htmlInvitacion, textoInvitacion } from "./template-invitacion";
import type {
  AppointmentEmailInput,
  EmailProvider,
  EmailSendResult,
  InvitationEmailInput,
} from "./types";

interface ResendConfig {
  apiKey: string;
  from: string;
  replyTo?: string;
}

/**
 * Adaptador de Resend detrás de la interfaz EmailProvider. Usa la API REST
 * directamente (sin SDK) para mantener las dependencias mínimas. Los errores
 * devuelven una razón NO sensible (nunca el cuerpo del correo ni el enlace).
 */
export function createResendEmailProvider(config: ResendConfig): EmailProvider {
  return {
    name: "resend",
    async sendInvitation(input: InvitationEmailInput): Promise<EmailSendResult> {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [input.to],
            reply_to: config.replyTo,
            subject: asuntoInvitacion(input),
            html: htmlInvitacion(input),
            text: textoInvitacion(input),
          }),
        });

        if (!response.ok) {
          return {
            sent: false,
            reason: `El proveedor de correo respondió ${response.status}.`,
          };
        }
        const body = (await response.json()) as { id?: string };
        return { sent: true, providerId: body.id };
      } catch {
        // Sin detalles del error hacia arriba: puede contener URLs internas.
        return { sent: false, reason: "No fue posible contactar al proveedor de correo." };
      }
    },
    async sendAppointmentEmail(input: AppointmentEmailInput): Promise<EmailSendResult> {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to: [input.to],
            reply_to: config.replyTo,
            subject: input.subject,
            html: input.html,
            text: input.text,
          }),
        });
        if (!response.ok) {
          return { sent: false, reason: `El proveedor de correo respondió ${response.status}.` };
        }
        const body = (await response.json()) as { id?: string };
        return { sent: true, providerId: body.id };
      } catch {
        return { sent: false, reason: "No fue posible contactar al proveedor de correo." };
      }
    },
  };
}
