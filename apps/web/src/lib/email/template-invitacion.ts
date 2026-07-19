import type { InvitationEmailInput } from "./types";

/** Asunto del correo de invitación (es-MX). */
export function asuntoInvitacion(input: InvitationEmailInput): string {
  return `Invitación para unirte a ${input.clinicName} en Dogtoralia`;
}

/** Versión de texto plano (alternativa accesible). */
export function textoInvitacion(input: InvitationEmailInput): string {
  const saludo = input.inviteeName ? `Hola, ${input.inviteeName}:` : "Hola:";
  const invitador = input.invitedByName ? ` por ${input.invitedByName}` : "";
  return [
    saludo,
    "",
    `Fuiste invitad@${invitador} a unirte a ${input.clinicName} en Dogtoralia`,
    `con el rol de ${input.roleLabel}.`,
    "",
    "Para aceptar la invitación, abre este enlace:",
    input.acceptUrl,
    "",
    `La invitación vence el ${input.expiresAtText}.`,
    "",
    "Si no esperabas este correo, puedes ignorarlo con seguridad.",
    "— Dogtoralia · Gestión veterinaria",
  ].join("\n");
}

/** Versión HTML sencilla, sin imágenes remotas ni rastreadores. */
export function htmlInvitacion(input: InvitationEmailInput): string {
  const saludo = input.inviteeName ? `Hola, ${escapeHtml(input.inviteeName)}:` : "Hola:";
  const invitador = input.invitedByName
    ? ` por <strong>${escapeHtml(input.invitedByName)}</strong>`
    : "";
  return `<!doctype html>
<html lang="es-MX">
  <body style="margin:0;padding:24px;background:#f4f7f7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2a30;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8e8;">
      <p style="font-size:18px;font-weight:700;color:#1d6a63;margin:0 0 16px;">🐾 Dogtoralia</p>
      <p style="margin:0 0 12px;">${saludo}</p>
      <p style="margin:0 0 12px;">
        Fuiste invitad@${invitador} a unirte a <strong>${escapeHtml(input.clinicName)}</strong>
        con el rol de <strong>${escapeHtml(input.roleLabel)}</strong>.
      </p>
      <p style="margin:24px 0;">
        <a href="${input.acceptUrl}"
           style="background:#1d6a63;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:600;">
          Aceptar invitación
        </a>
      </p>
      <p style="margin:0 0 12px;font-size:14px;color:#5b6b70;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br />
        <span style="word-break:break-all;">${input.acceptUrl}</span>
      </p>
      <p style="margin:0 0 12px;font-size:14px;color:#5b6b70;">
        La invitación vence el ${escapeHtml(input.expiresAtText)}.
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#8a979b;">
        Si no esperabas este correo, puedes ignorarlo con seguridad.
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
