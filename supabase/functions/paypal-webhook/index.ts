// Webhook de PayPal (Edge Function, Deno) — Fase 14.
//
// Única pluma de PayPal sobre `public.subscriptions` (service_role). Verifica
// cada entrega con el endpoint oficial `verify-webhook-signature` (requiere
// PAYPAL_WEBHOOK_ID y las credenciales REST) y, detrás del flag `COBRO_ACTIVO`
// (mismo criterio que stripe-webhook), traduce los eventos de suscripción de
// PayPal a nuestros estados:
//   BILLING.SUBSCRIPTION.ACTIVATED / RE-ACTIVATED / UPDATED → active
//   BILLING.SUBSCRIPTION.SUSPENDED / PAYMENT.FAILED         → past_due
//   BILLING.SUBSCRIPTION.CANCELLED / EXPIRED                → canceled
//   PAYMENT.SALE.COMPLETED → refresca el fin del periodo (next_billing_time)
// La clínica llega en `resource.custom_id` (lo puso el panel al crear la
// suscripción); como respaldo se actualiza por `paypal_subscription_id`.
// Nunca se registra el cuerpo del evento ni credenciales.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const COBRO_ACTIVO = (Deno.env.get("COBRO_ACTIVO") ?? "false") === "true";

// --- Configuración ----------------------------------------------------------

interface Config {
  supabaseUrl: string;
  serviceRoleKey: string;
  clientId: string;
  clientSecret: string;
  webhookId: string;
  apiBase: string;
}

function leerConfig(): Config | null {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "";
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID") ?? "";
  if (clientId.length === 0 || clientSecret.length === 0 || webhookId.length === 0) {
    return null;
  }
  const modo = Deno.env.get("PAYPAL_MODE") ?? "live";
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    clientId,
    clientSecret,
    webhookId,
    apiBase: modo === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com",
  };
}

// --- Utilidades -------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function resumirError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  return String(error).slice(0, 200);
}

function comoObjeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" ? valor as Record<string, unknown> : {};
}

function cadena(fuente: Record<string, unknown>, clave: string): string | null {
  const valor = fuente[clave];
  return typeof valor === "string" && valor.length > 0 ? valor : null;
}

// --- Autenticación y verificación de firma ----------------------------------

async function obtenerToken(cfg: Config): Promise<string> {
  const respuesta = await fetch(`${cfg.apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${cfg.clientId}:${cfg.clientSecret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const cuerpo = comoObjeto(await respuesta.json());
  const token = cadena(cuerpo, "access_token");
  if (!respuesta.ok || token === null) {
    throw new Error("PayPal no autenticó las credenciales del webhook.");
  }
  return token;
}

/**
 * Verificación oficial: se reenvían los headers de la transmisión y el evento
 * al endpoint de PayPal, que responde SUCCESS solo si la firma es válida para
 * el webhook configurado (PAYPAL_WEBHOOK_ID).
 */
async function verificarFirma(
  cfg: Config,
  token: string,
  headers: Headers,
  evento: unknown,
): Promise<boolean> {
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return false;
  }

  const respuesta = await fetch(`${cfg.apiBase}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      transmission_sig: transmissionSig,
      cert_url: certUrl,
      auth_algo: authAlgo,
      webhook_id: cfg.webhookId,
      webhook_event: evento,
    }),
  });
  const cuerpo = comoObjeto(await respuesta.json());
  return respuesta.ok && cuerpo["verification_status"] === "SUCCESS";
}

// --- Handlers ---------------------------------------------------------------

type EstadoPropio = "active" | "past_due" | "canceled";

/** Fin de periodo informado por PayPal (billing_info.next_billing_time). */
function finDePeriodo(recurso: Record<string, unknown>): string | null {
  const billing = comoObjeto(recurso["billing_info"]);
  return cadena(billing, "next_billing_time");
}

async function actualizarSuscripcion(
  supabase: SupabaseClient | null,
  recurso: Record<string, unknown>,
  estado: EstadoPropio,
  paypalSubscriptionId: string,
): Promise<void> {
  if (!COBRO_ACTIVO || supabase === null) {
    console.log(
      `[scaffold] suscripción PayPal ${paypalSubscriptionId} → ${estado} (mutación desactivada: COBRO_ACTIVO=false)`,
    );
    return;
  }

  const cambios: Record<string, unknown> = {
    status: estado,
    payment_provider: "paypal",
    paypal_subscription_id: paypalSubscriptionId,
  };
  const fin = finDePeriodo(recurso);
  if (fin !== null) cambios.current_period_end = fin;
  const inicio = cadena(recurso, "start_time");
  if (inicio !== null && estado === "active") cambios.current_period_start = inicio;

  // La clínica llega en custom_id; como respaldo, la fila ya vinculada al id.
  const clinicId = cadena(recurso, "custom_id");
  const consulta = supabase.from("subscriptions").update(cambios, { count: "exact" });
  const { error, count } = clinicId !== null
    ? await consulta.eq("clinic_id", clinicId)
    : await consulta.eq("paypal_subscription_id", paypalSubscriptionId);
  if (error) {
    throw new Error(`no se pudo actualizar la suscripción: ${error.message}`);
  }
  if (count === 0) {
    console.warn(
      `[webhook] evento de PayPal sin fila destino (clinic ${
        clinicId ?? "?"
      }, sub ${paypalSubscriptionId})`,
    );
  }
}

/** PAYMENT.SALE.COMPLETED: el recurso es el pago; se consulta la suscripción. */
async function manejarPagoCompletado(
  cfg: Config,
  supabase: SupabaseClient | null,
  recurso: Record<string, unknown>,
): Promise<void> {
  const subscriptionId = cadena(recurso, "billing_agreement_id");
  if (subscriptionId === null) {
    console.log("[webhook] PAYMENT.SALE.COMPLETED sin billing_agreement_id; ignorado");
    return;
  }
  if (!COBRO_ACTIVO || supabase === null) {
    console.log(
      `[scaffold] pago de PayPal para ${subscriptionId} (mutación desactivada: COBRO_ACTIVO=false)`,
    );
    return;
  }
  const token = await obtenerToken(cfg);
  const respuesta = await fetch(
    `${cfg.apiBase}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!respuesta.ok) {
    console.error(`[webhook] no se pudo consultar la suscripción (HTTP ${respuesta.status})`);
    return;
  }
  const suscripcion = comoObjeto(await respuesta.json());
  await actualizarSuscripcion(supabase, suscripcion, "active", subscriptionId);
}

async function enrutarEvento(
  cfg: Config,
  supabase: SupabaseClient | null,
  tipo: string,
  recurso: Record<string, unknown>,
): Promise<void> {
  const subscriptionId = cadena(recurso, "id");
  switch (tipo) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
      if (subscriptionId !== null) {
        await actualizarSuscripcion(supabase, recurso, "active", subscriptionId);
      }
      break;
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      if (subscriptionId !== null) {
        await actualizarSuscripcion(supabase, recurso, "past_due", subscriptionId);
      }
      break;
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      if (subscriptionId !== null) {
        await actualizarSuscripcion(supabase, recurso, "canceled", subscriptionId);
      }
      break;
    case "PAYMENT.SALE.COMPLETED":
      await manejarPagoCompletado(cfg, supabase, recurso);
      break;
    default:
      console.log(`[webhook] evento ${tipo} sin handler; sin acción`);
  }
}

// --- Servidor HTTP ----------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "método no permitido" }, 405);
  }

  const cfg = leerConfig();
  if (cfg === null) {
    console.error(
      "Faltan PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET/PAYPAL_WEBHOOK_ID; se rechaza la invocación.",
    );
    return jsonResponse({ error: "servidor mal configurado" }, 500);
  }

  let evento: Record<string, unknown>;
  try {
    evento = comoObjeto(await req.json());
  } catch {
    return jsonResponse({ error: "cuerpo no es JSON válido" }, 400);
  }
  const tipo = cadena(evento, "event_type");
  if (tipo === null) {
    return jsonResponse({ error: "evento inválido" }, 400);
  }

  let firmaValida = false;
  try {
    const token = await obtenerToken(cfg);
    firmaValida = await verificarFirma(cfg, token, req.headers, evento);
  } catch (error) {
    console.error(`Error al verificar la firma: ${resumirError(error)}`);
    firmaValida = false;
  }
  if (!firmaValida) {
    return jsonResponse({ error: "firma inválida" }, 400);
  }

  let supabase: SupabaseClient | null = null;
  if (COBRO_ACTIVO && cfg.supabaseUrl.length > 0 && cfg.serviceRoleKey.length > 0) {
    supabase = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  try {
    await enrutarEvento(cfg, supabase, tipo, comoObjeto(evento["resource"]));
    return jsonResponse({ received: true }, 200);
  } catch (error) {
    console.error(`Error al procesar el evento ${tipo}: ${resumirError(error)}`);
    return jsonResponse(
      { received: true, warning: "el evento se aceptó pero el handler falló" },
      200,
    );
  }
});
