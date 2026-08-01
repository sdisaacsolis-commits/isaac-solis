import "server-only";

import type { Tables } from "@dogtoralia/types";

import { formatearFechaLarga } from "@/lib/agenda/dates";
import { getEmailProvider } from "@/lib/email";
import { logOperational } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

/**
 * Procesador del outbox de recordatorios de vacunación. Mismo patrón que la
 * agenda (claim/mark con la SESIÓN del usuario operativo; jamás service_role
 * en apps/web): se invoca de forma oportunista tras registrar o anular
 * vacunas, y un procesador de backend podrá reutilizar las mismas RPCs.
 * El correo SOLO lleva datos operativos (mascota, vacuna, fecha, clínica);
 * nunca lote, notas ni contenido clínico adicional.
 */

type NotificacionVacunacion = Tables<"vaccination_notifications">;

interface CargaVacunacion {
  pet_name?: string;
  vaccine_name?: string;
  next_due_at?: string;
  clinic_name?: string;
  clinic_timezone?: string;
}

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Arma asunto y cuerpos del correo desde el payload NO clínico del outbox. */
export function armarCorreoVacunacion(notificacion: NotificacionVacunacion): {
  subject: string;
  text: string;
  html: string;
} {
  const carga = (notificacion.payload ?? {}) as CargaVacunacion;
  const mascota = carga.pet_name ?? "tu mascota";
  const vacuna = carga.vaccine_name ?? "vacuna";
  const clinica = carga.clinic_name ?? "tu clínica veterinaria";
  const cuando = carga.next_due_at
    ? formatearFechaLarga(carga.next_due_at, carga.clinic_timezone ?? undefined)
    : "";
  const subject = `Recordatorio de vacunación · ${mascota}`;
  const encabezado = "Se acerca la próxima dosis de vacunación.";

  const lineas = [
    notificacion.recipient_name ? `Hola, ${notificacion.recipient_name}:` : "Hola:",
    "",
    encabezado,
    "",
    `Mascota: ${mascota}`,
    `Vacuna: ${vacuna}`,
    cuando ? `Fecha programada: ${cuando}` : "",
    `Clínica: ${clinica}`,
    "",
    "Agenda tu cita con la clínica para aplicar la dosis.",
    "— Dogtoralia · Gestión veterinaria",
  ].filter((l) => l !== "");

  const html = `<!doctype html>
<html lang="es-MX">
  <body style="margin:0;padding:24px;background:#f4f7f7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2a30;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8e8;">
      <p style="font-size:18px;font-weight:700;color:#1d6a63;margin:0 0 16px;">🐾 Dogtoralia</p>
      <p style="margin:0 0 12px;">${escapeHtml(encabezado)}</p>
      <table style="margin:0 0 16px;border-collapse:collapse;">
        <tr><td style="padding:2px 12px 2px 0;color:#5a6b70;">Mascota</td><td>${escapeHtml(mascota)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5a6b70;">Vacuna</td><td>${escapeHtml(vacuna)}</td></tr>
        ${cuando ? `<tr><td style="padding:2px 12px 2px 0;color:#5a6b70;">Fecha programada</td><td>${escapeHtml(cuando)}</td></tr>` : ""}
        <tr><td style="padding:2px 12px 2px 0;color:#5a6b70;">Clínica</td><td>${escapeHtml(clinica)}</td></tr>
      </table>
      <p style="margin:0;color:#5a6b70;font-size:13px;">Agenda tu cita con la clínica para aplicar la dosis.</p>
    </div>
  </body>
</html>`;

  return { subject, text: lineas.join("\n"), html };
}

/**
 * Reclama y envía los recordatorios de vacunación vencidos de la clínica.
 * Mejor esfuerzo: cualquier fallo queda en el outbox (reintentos) y en el log
 * operativo, nunca rompe la acción del usuario.
 */
export async function procesarNotificacionesVacunacionDeClinica(clinicId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: pendientes, error } = await supabase.rpc("claim_due_vaccination_notifications", {
      p_clinic_id: clinicId,
      p_limit: 20,
    });
    if (error || !pendientes || pendientes.length === 0) return;

    const proveedor = getEmailProvider();
    for (const notificacion of pendientes as NotificacionVacunacion[]) {
      let ok = false;
      let detalle: string | null = null;
      if (notificacion.channel === "email" && notificacion.recipient_email) {
        const correo = armarCorreoVacunacion(notificacion);
        const resultado = await proveedor.sendAppointmentEmail({
          to: notificacion.recipient_email,
          ...correo,
        });
        // En modo dev sendAppointmentEmail reporta sent:false; el outbox lo
        // marca como enviado igualmente para no reintentar en desarrollo.
        ok = resultado.sent || proveedor.name === "dev";
        detalle = resultado.sent ? null : resultado.reason;
      } else {
        detalle = `Canal ${notificacion.channel} sin proveedor configurado.`;
      }
      await supabase.rpc("mark_vaccination_notification", {
        p_notification_id: notificacion.id,
        p_ok: ok,
        p_error: detalle ?? undefined,
      });
    }
  } catch (error) {
    logOperational("vacunacion.notificaciones.fallo", { error: String(error) });
  }
}
