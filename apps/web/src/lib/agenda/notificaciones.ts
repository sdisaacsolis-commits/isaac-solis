import "server-only";

import type { Tables } from "@dogtoralia/types";

import { getEmailProvider } from "@/lib/email";
import { logOperational } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

import { formatearFechaHora } from "./dates";

/**
 * Procesador del outbox de notificaciones de citas. Corre con la SESIÓN del
 * usuario operativo (RPCs claim/mark validan permisos; jamás service_role en
 * apps/web). Se invoca de forma oportunista tras cada acción de agenda: los
 * correos inmediatos salen al momento y los recordatorios vencidos se envían
 * en cuanto alguien del personal opera el panel. Un procesador de backend
 * (Edge Function + cron) podrá reutilizar las mismas RPCs después
 * (docs/appointments/notifications.md).
 */

type Notificacion = Tables<"appointment_notifications">;

interface CargaCita {
  folio?: string;
  clinic_name?: string;
  clinic_timezone?: string;
  pet_name?: string;
  scheduled_start?: string;
}

const ASUNTOS: Record<string, (folio: string) => string> = {
  confirmation: (f) => `Cita confirmada · ${f}`,
  reminder_24h: (f) => `Recordatorio: tu cita es mañana · ${f}`,
  reminder_2h: (f) => `Recordatorio: tu cita es en unas horas · ${f}`,
  cancellation: (f) => `Cita cancelada · ${f}`,
  reschedule: (f) => `Tu cita cambió de horario · ${f}`,
};

const ENCABEZADOS: Record<string, string> = {
  confirmation: "Tu cita quedó confirmada.",
  reminder_24h: "Te recordamos tu cita de mañana.",
  reminder_2h: "Tu cita es hoy, en unas horas.",
  cancellation: "Tu cita fue cancelada.",
  reschedule: "Tu cita cambió de fecha u hora.",
};

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Arma asunto y cuerpos del correo desde el payload NO clínico del outbox. */
export function armarCorreoCita(notificacion: Notificacion): {
  subject: string;
  text: string;
  html: string;
} {
  const carga = (notificacion.payload ?? {}) as CargaCita;
  const folio = carga.folio ?? "cita";
  const clinica = carga.clinic_name ?? "tu clínica veterinaria";
  const mascota = carga.pet_name ?? "tu mascota";
  const cuando = carga.scheduled_start
    ? formatearFechaHora(carga.scheduled_start, carga.clinic_timezone ?? undefined)
    : "";
  const encabezado = ENCABEZADOS[notificacion.type] ?? "Información de tu cita.";
  const subject = (ASUNTOS[notificacion.type] ?? ((f: string) => `Tu cita · ${f}`))(folio);

  const lineas = [
    notificacion.recipient_name ? `Hola, ${notificacion.recipient_name}:` : "Hola:",
    "",
    encabezado,
    "",
    `Mascota: ${mascota}`,
    cuando ? `Fecha y hora: ${cuando}` : "",
    `Clínica: ${clinica}`,
    `Folio: ${folio}`,
    "",
    "Si necesitas mover o cancelar la cita, contacta a tu clínica.",
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
        ${cuando ? `<tr><td style="padding:2px 12px 2px 0;color:#5a6b70;">Fecha y hora</td><td>${escapeHtml(cuando)}</td></tr>` : ""}
        <tr><td style="padding:2px 12px 2px 0;color:#5a6b70;">Clínica</td><td>${escapeHtml(clinica)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#5a6b70;">Folio</td><td>${escapeHtml(folio)}</td></tr>
      </table>
      <p style="margin:0;color:#5a6b70;font-size:13px;">Si necesitas mover o cancelar la cita, contacta a tu clínica.</p>
    </div>
  </body>
</html>`;

  return { subject, text: lineas.join("\n"), html };
}

/**
 * Reclama y envía las notificaciones vencidas de la clínica. Mejor esfuerzo:
 * cualquier fallo queda en el outbox (reintentos) y en el log operativo,
 * nunca rompe la acción del usuario.
 */
export async function procesarNotificacionesDeClinica(clinicId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: pendientes, error } = await supabase.rpc("claim_due_appointment_notifications", {
      p_clinic_id: clinicId,
      p_limit: 20,
    });
    if (error || !pendientes || pendientes.length === 0) return;

    const proveedor = getEmailProvider();
    for (const notificacion of pendientes as Notificacion[]) {
      let ok = false;
      let detalle: string | null = null;
      if (notificacion.channel === "email" && notificacion.recipient_email) {
        const correo = armarCorreoCita(notificacion);
        const resultado = await proveedor.sendAppointmentEmail({
          to: notificacion.recipient_email,
          ...correo,
        });
        // En modo dev sendAppointmentEmail reporta sent:false; el outbox lo
        // marca como enviado igualmente para no reintentar en desarrollo.
        ok = resultado.sent || proveedor.name === "dev";
        detalle = resultado.sent ? null : resultado.reason;
      } else {
        // Canales whatsapp/push/sms: preparados, sin proveedor en esta fase.
        detalle = `Canal ${notificacion.channel} sin proveedor configurado.`;
      }
      await supabase.rpc("mark_appointment_notification", {
        p_notification_id: notificacion.id,
        p_ok: ok,
        p_error: detalle ?? undefined,
      });
    }
  } catch (error) {
    logOperational("agenda.notificaciones.fallo", { error: String(error) });
  }
}
