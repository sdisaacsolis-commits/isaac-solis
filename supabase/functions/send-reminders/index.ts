// Procesador PROGRAMADO de recordatorios (Edge Function, Deno).
//
// Reclama y envía las notificaciones vencidas de AMBOS outbox
// (`appointment_notifications` y `vaccination_notifications`) de forma
// cross-clínica, usando la service_role de Supabase y las RPCs
// SECURITY DEFINER reservadas a ese rol. Se invoca por un scheduler externo
// (pg_cron + pg_net, o un cron externo) cada pocos minutos: ver README.md.
//
// Reglas de este proyecto que se respetan aquí:
//  - La service_role solo vive en Edge Functions/CI, nunca llega a un cliente.
//  - Nada de datos clínicos sensibles en el correo (solo datos operativos).
//  - En modo dev los correos se REDACTAN (email enmascarado) y jamás se
//    imprime el token del proveedor.
//  - Errores explícitos; un fallo individual no rompe el lote.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// --- Tipos del dominio -----------------------------------------------------

/** Canales soportados por el enum `notification_channel`. */
type NotificationChannel = "email" | "whatsapp" | "push" | "sms";

/** Fila de outbox (columnas comunes a citas y vacunas). */
interface NotificationRow {
  id: string;
  type: string;
  channel: NotificationChannel;
  recipient_name: string | null;
  recipient_email: string | null;
  payload: unknown;
}

/** Payload NO clínico de una notificación de cita. Campos defensivos. */
interface AppointmentPayload {
  folio?: string;
  clinic_name?: string;
  clinic_timezone?: string;
  pet_name?: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

/** Payload NO clínico de una notificación de vacuna. Campos defensivos. */
interface VaccinationPayload {
  pet_name?: string;
  vaccine_name?: string;
  next_due_at?: string;
  clinic_name?: string;
  clinic_timezone?: string;
}

/** Correo listo para enviar. */
interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

/** Resultado del intento de envío de una notificación. */
interface SendResult {
  ok: boolean;
  error: string | null;
}

/** Resumen por outbox. */
interface OutboxSummary {
  processed: number;
  sent: number;
  failed: number;
}

// --- Configuración desde el entorno ----------------------------------------

interface Config {
  supabaseUrl: string;
  serviceRoleKey: string;
  cronSecret: string | null;
  emailMode: string;
  resendApiKey: string | null;
  emailFrom: string | null;
  emailReplyTo: string | null;
}

function leerConfig(): Config {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    cronSecret: Deno.env.get("CRON_SECRET") ?? null,
    emailMode: Deno.env.get("EMAIL_MODE") ?? "dev",
    resendApiKey: Deno.env.get("RESEND_API_KEY") ?? null,
    emailFrom: Deno.env.get("EMAIL_FROM") ?? null,
    emailReplyTo: Deno.env.get("EMAIL_REPLY_TO") ?? null,
  };
}

// --- Utilidades ------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Narrowing seguro de un `unknown` a un objeto plano de payload. */
function comoObjeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" ? valor as Record<string, unknown> : {};
}

/** Lee un string opcional del payload sin lanzar. */
function leerTexto(obj: Record<string, unknown>, clave: string): string | undefined {
  const v = obj[clave];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Enmascara un correo para logs de dev: `luis@dominio.com` → `l***@dominio.com`. */
function enmascararEmail(email: string): string {
  const arroba = email.indexOf("@");
  if (arroba <= 0) return "***";
  const inicial = email[0] ?? "";
  const dominio = email.slice(arroba + 1);
  return `${inicial}***@${dominio}`;
}

/**
 * Formatea una fecha/hora ISO a español de México en la zona horaria de la
 * clínica. Presentación en `America/Mexico_City` por defecto.
 */
function formatearFechaHora(iso: string, timezone?: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone ?? "America/Mexico_City",
    }).format(fecha);
  } catch {
    // Zona horaria inválida en el payload: caemos a la de la clínica base.
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Mexico_City",
    }).format(fecha);
  }
}

/** Formatea solo la fecha (para próximas dosis, que son `date`). */
function formatearFecha(valor: string, timezone?: string): string {
  // Las fechas tipo `YYYY-MM-DD` se interpretan a mediodía UTC para evitar
  // que la conversión de zona horaria las mueva un día.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? `${valor}T12:00:00Z` : valor;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return valor;
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeZone: timezone ?? "America/Mexico_City",
    }).format(fecha);
  } catch {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeZone: "America/Mexico_City",
    }).format(fecha);
  }
}

/** Envuelve las filas de una tabla HTML de detalle. */
function tablaHtml(filas: Array<[string, string]>): string {
  const celdas = filas
    .map(
      ([etiqueta, valor]) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#5a6b70;">${escapeHtml(etiqueta)}</td><td>${
          escapeHtml(valor)
        }</td></tr>`,
    )
    .join("\n        ");
  return `<table style="margin:0 0 16px;border-collapse:collapse;">
        ${celdas}
      </table>`;
}

/** Plantilla común del correo (marca Dogtoralia, estilo del panel). */
function envolverHtml(encabezado: string, filas: Array<[string, string]>, pie: string): string {
  return `<!doctype html>
<html lang="es-MX">
  <body style="margin:0;padding:24px;background:#f4f7f7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2a30;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8e8;">
      <p style="font-size:18px;font-weight:700;color:#1d6a63;margin:0 0 16px;">🐾 Dogtoralia</p>
      <p style="margin:0 0 12px;">${escapeHtml(encabezado)}</p>
      ${tablaHtml(filas)}
      <p style="margin:0;color:#5a6b70;font-size:13px;">${escapeHtml(pie)}</p>
    </div>
  </body>
</html>`;
}

// --- Armado de correos -----------------------------------------------------

const ASUNTOS_CITA: Record<string, (folio: string) => string> = {
  confirmation: (f) => `Cita confirmada · ${f}`,
  reminder_24h: (f) => `Recordatorio: tu cita es mañana · ${f}`,
  reminder_2h: (f) => `Recordatorio: tu cita es en unas horas · ${f}`,
  cancellation: (f) => `Cita cancelada · ${f}`,
  reschedule: (f) => `Tu cita cambió de horario · ${f}`,
};

const ENCABEZADOS_CITA: Record<string, string> = {
  confirmation: "Tu cita quedó confirmada.",
  reminder_24h: "Te recordamos tu cita de mañana.",
  reminder_2h: "Tu cita es hoy, en unas horas.",
  cancellation: "Tu cita fue cancelada.",
  reschedule: "Tu cita cambió de fecha u hora.",
};

/** Arma el correo de una notificación de cita desde su payload no clínico. */
function armarCorreoCita(fila: NotificationRow): EmailContent {
  const carga = comoObjeto(fila.payload) as AppointmentPayload & Record<string, unknown>;
  const folio = leerTexto(carga, "folio") ?? "cita";
  const clinica = leerTexto(carga, "clinic_name") ?? "tu clínica veterinaria";
  const mascota = leerTexto(carga, "pet_name") ?? "tu mascota";
  const timezone = leerTexto(carga, "clinic_timezone");
  const inicio = leerTexto(carga, "scheduled_start");
  const cuando = inicio ? formatearFechaHora(inicio, timezone) : "";
  const encabezado = ENCABEZADOS_CITA[fila.type] ?? "Información de tu cita.";
  const asunto = (ASUNTOS_CITA[fila.type] ?? ((f: string) => `Tu cita · ${f}`))(folio);

  const lineas = [
    fila.recipient_name ? `Hola, ${fila.recipient_name}:` : "Hola:",
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

  const filasDetalle: Array<[string, string]> = [["Mascota", mascota]];
  if (cuando) filasDetalle.push(["Fecha y hora", cuando]);
  filasDetalle.push(["Clínica", clinica], ["Folio", folio]);

  return {
    subject: asunto,
    text: lineas.join("\n"),
    html: envolverHtml(
      encabezado,
      filasDetalle,
      "Si necesitas mover o cancelar la cita, contacta a tu clínica.",
    ),
  };
}

/** Arma el correo de una notificación de vacuna desde su payload no clínico. */
function armarCorreoVacuna(fila: NotificationRow): EmailContent {
  const carga = comoObjeto(fila.payload) as VaccinationPayload & Record<string, unknown>;
  const mascota = leerTexto(carga, "pet_name") ?? "tu mascota";
  const vacuna = leerTexto(carga, "vaccine_name") ?? "una vacuna";
  const clinica = leerTexto(carga, "clinic_name") ?? "tu clínica veterinaria";
  const timezone = leerTexto(carga, "clinic_timezone");
  const proxima = leerTexto(carga, "next_due_at");
  const cuando = proxima ? formatearFecha(proxima, timezone) : "";
  const encabezado = `${mascota} tiene una vacuna próxima a vencer.`;
  const asunto = `Recordatorio de vacunación · ${mascota}`;

  const lineas = [
    fila.recipient_name ? `Hola, ${fila.recipient_name}:` : "Hola:",
    "",
    encabezado,
    "",
    `Mascota: ${mascota}`,
    `Vacuna: ${vacuna}`,
    cuando ? `Próxima fecha: ${cuando}` : "",
    `Clínica: ${clinica}`,
    "",
    "Agenda la siguiente dosis con tu clínica para mantener a tu mascota protegida.",
    "— Dogtoralia · Gestión veterinaria",
  ].filter((l) => l !== "");

  const filasDetalle: Array<[string, string]> = [
    ["Mascota", mascota],
    ["Vacuna", vacuna],
  ];
  if (cuando) filasDetalle.push(["Próxima fecha", cuando]);
  filasDetalle.push(["Clínica", clinica]);

  return {
    subject: asunto,
    text: lineas.join("\n"),
    html: envolverHtml(
      encabezado,
      filasDetalle,
      "Agenda la siguiente dosis con tu clínica para mantener a tu mascota protegida.",
    ),
  };
}

// --- Envío del correo ------------------------------------------------------

/**
 * Envía el correo por el proveedor configurado. Si no hay proveedor productivo
 * (modo dev), registra una línea REDACTADA y trata el envío como exitoso para
 * no reintentar en desarrollo. Nunca imprime el correo completo ni el token.
 */
async function enviarCorreo(
  cfg: Config,
  destino: string,
  correo: EmailContent,
): Promise<SendResult> {
  const modoResend = cfg.emailMode === "resend" && cfg.resendApiKey !== null &&
    cfg.emailFrom !== null;

  if (!modoResend) {
    // Modo dev: log redactado (email enmascarado, sin cuerpo ni token).
    console.log(
      `[dev] correo simulado → ${enmascararEmail(destino)} · asunto: ${correo.subject}`,
    );
    return { ok: true, error: null };
  }

  try {
    const cuerpo: Record<string, unknown> = {
      from: cfg.emailFrom,
      to: [destino],
      subject: correo.subject,
      text: correo.text,
      html: correo.html,
    };
    if (cfg.emailReplyTo !== null) {
      cuerpo.reply_to = cfg.emailReplyTo;
    }

    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${cfg.resendApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(cuerpo),
    });

    if (respuesta.ok) {
      // Consumimos el cuerpo para liberar la conexión; no lo registramos.
      await respuesta.body?.cancel();
      return { ok: true, error: null };
    }

    // Resumimos el error del proveedor sin volcar datos sensibles.
    return { ok: false, error: `proveedor respondió ${respuesta.status}` };
  } catch (error) {
    return { ok: false, error: `fallo de red al enviar: ${resumirError(error)}` };
  }
}

/** Resume un error como texto corto sin exponer detalles internos. */
function resumirError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  return String(error).slice(0, 200);
}

// --- Procesamiento de un outbox --------------------------------------------

type TipoOutbox = "appointment" | "vaccination";

const RPC_POR_OUTBOX: Record<
  TipoOutbox,
  { claim: string; mark: string; armar: (fila: NotificationRow) => EmailContent }
> = {
  appointment: {
    claim: "claim_due_appointment_notifications_batch",
    mark: "mark_appointment_notification_by_service",
    armar: armarCorreoCita,
  },
  vaccination: {
    claim: "claim_due_vaccination_notifications_batch",
    mark: "mark_vaccination_notification_by_service",
    armar: armarCorreoVacuna,
  },
};

/**
 * Reclama el lote vencido de un outbox y procesa cada notificación. Mejor
 * esfuerzo: un fallo individual marca esa notificación como fallida
 * (reintentable) y continúa con la siguiente.
 */
async function procesarOutbox(
  supabase: SupabaseClient,
  cfg: Config,
  tipo: TipoOutbox,
): Promise<OutboxSummary> {
  const resumen: OutboxSummary = { processed: 0, sent: 0, failed: 0 };
  const config = RPC_POR_OUTBOX[tipo];

  const { data, error } = await supabase.rpc(config.claim, { p_limit: 50 });
  if (error) {
    throw new Error(`RPC ${config.claim} falló: ${error.message}`);
  }

  const filas = Array.isArray(data) ? data as NotificationRow[] : [];
  for (const fila of filas) {
    resumen.processed += 1;
    let resultado: SendResult;
    try {
      if (fila.channel === "email" && fila.recipient_email) {
        const correo = config.armar(fila);
        resultado = await enviarCorreo(cfg, fila.recipient_email, correo);
      } else {
        // Canales whatsapp/push/sms: preparados, sin proveedor en esta fase.
        resultado = {
          ok: false,
          error: `canal ${fila.channel} sin proveedor configurado`,
        };
      }
    } catch (error) {
      // Nunca dejamos escapar un error: la notificación queda reintentable.
      resultado = { ok: false, error: resumirError(error) };
    }

    if (resultado.ok) resumen.sent += 1;
    else resumen.failed += 1;

    try {
      const { error: marcarError } = await supabase.rpc(config.mark, {
        p_notification_id: fila.id,
        p_ok: resultado.ok,
        p_error: resultado.error,
      });
      if (marcarError) {
        console.error(`No se pudo marcar ${fila.id}: ${marcarError.message}`);
      }
    } catch (error) {
      console.error(`Error al marcar ${fila.id}: ${resumirError(error)}`);
    }
  }

  return resumen;
}

// --- Servidor HTTP ---------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const cfg = leerConfig();

  // Sin secreto configurado no procesamos: sería un endpoint abierto.
  if (cfg.cronSecret === null || cfg.cronSecret.length === 0) {
    console.error("CRON_SECRET no está configurado; se rechaza la invocación.");
    return jsonResponse(
      { error: "servidor mal configurado: falta CRON_SECRET" },
      500,
    );
  }

  // Autenticación por header Authorization: Bearer <CRON_SECRET>.
  const autorizacion = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${cfg.cronSecret}`;
  if (autorizacion !== esperado) {
    return jsonResponse({ error: "no autorizado" }, 401);
  }

  if (cfg.supabaseUrl.length === 0 || cfg.serviceRoleKey.length === 0) {
    console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    return jsonResponse(
      { error: "servidor mal configurado: faltan credenciales de Supabase" },
      500,
    );
  }

  const supabase = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const appointments = await procesarOutbox(supabase, cfg, "appointment");
    const vaccinations = await procesarOutbox(supabase, cfg, "vaccination");
    return jsonResponse({ ok: true, appointments, vaccinations }, 200);
  } catch (error) {
    console.error(`Error al procesar recordatorios: ${resumirError(error)}`);
    return jsonResponse(
      { ok: false, error: "no se pudo procesar el lote de recordatorios" },
      500,
    );
  }
});
