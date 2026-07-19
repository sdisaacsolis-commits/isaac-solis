import { redactSensitive } from "@/lib/log";

import type { EmailProvider, EmailSendResult, InvitationEmailInput } from "./types";

type Sink = (line: string) => void;

/**
 * Adaptador de desarrollo: NO envía correos reales. Registra una versión
 * redactada (el token del enlace se reduce a sus últimos 4 caracteres) para
 * depuración controlada, y reporta sent: false para que la UI informe con
 * claridad que el correo no fue enviado.
 */
export function createDevEmailProvider(sink: Sink = (line) => console.warn(line)): EmailProvider {
  return {
    name: "dev",
    sendInvitation(input: InvitationEmailInput): Promise<EmailSendResult> {
      sink(
        JSON.stringify({
          scope: "dogtoralia.email.dev",
          para: input.to,
          clinica: input.clinicName,
          rol: input.roleLabel,
          vence: input.expiresAtText,
          enlace: redactSensitive(input.acceptUrl),
        }),
      );
      return Promise.resolve({
        sent: false,
        reason: "Modo desarrollo (EMAIL_MODE=dev): el correo no se envía realmente.",
      });
    },
  };
}
