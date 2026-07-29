// Webhook de Stripe (Edge Function, Deno) — SCAFFOLD de la Fase 11.
//
// IMPORTANTE: el cobro NO está activo en el MVP. Esta función verifica la
// firma del webhook y ENRUTA los eventos de suscripción, pero los handlers
// están detrás del flag `COBRO_ACTIVO`: mientras esté en `false` solo
// registran (sin datos sensibles) y NO mutan `public.subscriptions`. La
// activación real del cobro (Stripe Checkout/Billing) llega en una fase
// posterior; ver README.md.
//
// Reglas de este proyecto que se respetan aquí:
//  - La service_role solo vive en Edge Functions/CI, nunca llega a un cliente.
//  - Verificación de firma obligatoria (esquema `t=…,v1=…` de Stripe) con
//    comparación en tiempo constante; sin secreto → 500, firma inválida → 400.
//  - Errores explícitos; nunca se lanza al cliente. Nunca se registra el cuerpo
//    del evento ni secretos.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// --- Flag de cobro ---------------------------------------------------------

/**
 * El MVP NO cobra: las suscripciones nacen en plan `beta` por trigger. Mientras
 * este flag esté en `false`, los handlers solo registran el enrutamiento y NO
 * mutan `public.subscriptions`. Se activará (junto con el flujo de Checkout)
 * en una fase posterior documentada en el ROADMAP.
 */
const COBRO_ACTIVO = false;

// --- Configuración desde el entorno ----------------------------------------

interface Config {
  supabaseUrl: string;
  serviceRoleKey: string;
  webhookSecret: string | null;
}

function leerConfig(): Config {
  return {
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    webhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? null,
  };
}

// --- Tipos mínimos del evento de Stripe ------------------------------------

/** Estados de Stripe que nos interesan del objeto `subscription`. */
type StripeSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/** Estados propios (enum `subscription_status` de la BD). */
type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

/** Interfaz mínima del objeto `subscription` de Stripe que consumimos. */
interface StripeSubscriptionObject {
  id: string;
  status: StripeSubscriptionStatus;
  current_period_start?: number;
  current_period_end?: number;
}

/** Interfaz mínima del objeto `invoice` de Stripe que consumimos. */
interface StripeInvoiceObject {
  id: string;
  subscription?: string | null;
}

/** Interfaz mínima del sobre del evento de Stripe. */
interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
}

// --- Utilidades ------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** Resume un error como texto corto sin exponer detalles internos. */
function resumirError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 200);
  return String(error).slice(0, 200);
}

/** Narrowing seguro de un `unknown` a un objeto plano. */
function comoObjeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" ? valor as Record<string, unknown> : {};
}

// --- Verificación de la firma del webhook ----------------------------------

/**
 * Parsea el header `Stripe-Signature` con el esquema `t=timestamp,v1=firma`.
 * Devuelve el timestamp y las firmas `v1` declaradas (puede haber varias
 * durante una rotación de secreto).
 */
function parsearFirma(header: string): { timestamp: string; firmas: string[] } | null {
  let timestamp: string | null = null;
  const firmas: string[] = [];
  for (const parte of header.split(",")) {
    const idx = parte.indexOf("=");
    if (idx <= 0) continue;
    const clave = parte.slice(0, idx).trim();
    const valor = parte.slice(idx + 1).trim();
    if (clave === "t") timestamp = valor;
    else if (clave === "v1") firmas.push(valor);
  }
  if (timestamp === null || timestamp.length === 0 || firmas.length === 0) return null;
  return { timestamp, firmas };
}

/** Convierte un `ArrayBuffer` a hex en minúsculas. */
function aHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let salida = "";
  for (const b of bytes) {
    salida += b.toString(16).padStart(2, "0");
  }
  return salida;
}

/**
 * Comparación en tiempo constante de dos cadenas hex del mismo esquema. No
 * corta antes de tiempo para no filtrar información por temporización.
 */
function comparacionConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifica la firma de Stripe: HMAC-SHA256 del payload `${t}.${body}` con el
 * `STRIPE_WEBHOOK_SECRET`, comparado en tiempo constante contra alguna de las
 * firmas `v1` del header. Devuelve `true` solo si coincide.
 */
async function verificarFirma(
  body: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parseado = parsearFirma(header);
  if (parseado === null) return false;

  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firmaCalculada = aHex(
    await crypto.subtle.sign(
      "HMAC",
      clave,
      new TextEncoder().encode(`${parseado.timestamp}.${body}`),
    ),
  );

  // Comparamos contra todas las firmas declaradas (rotación de secreto), sin
  // cortar antes de tiempo.
  let valida = false;
  for (const esperada of parseado.firmas) {
    if (comparacionConstante(firmaCalculada, esperada)) valida = true;
  }
  return valida;
}

// --- Mapeo de estados ------------------------------------------------------

/**
 * Mapea el estado de Stripe al enum `subscription_status` de la BD. Los estados
 * intermedios de Stripe (`incomplete*`, `unpaid`, `paused`) se colapsan a un
 * estado propio conservador.
 */
function mapearEstado(estado: StripeSubscriptionStatus): SubscriptionStatus {
  switch (estado) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "canceled";
  }
}

/** Convierte un epoch (segundos) de Stripe a ISO 8601 (UTC), si viene. */
function epochAIso(epoch: number | undefined): string | null {
  if (typeof epoch !== "number" || !Number.isFinite(epoch)) return null;
  return new Date(epoch * 1000).toISOString();
}

// --- Handlers (ESQUEMÁTICOS, detrás de COBRO_ACTIVO) -----------------------

/**
 * Actualiza `public.subscriptions` por `stripe_subscription_id`. SOLO se
 * ejecuta si `COBRO_ACTIVO` está en `true`. En el MVP este flag es `false`, así
 * que la mutación queda desactivada y el evento solo se registra.
 */
async function actualizarSuscripcion(
  supabase: SupabaseClient | null,
  stripeSubscriptionId: string,
  estado: SubscriptionStatus,
  periodo: { start: string | null; end: string | null },
): Promise<void> {
  if (!COBRO_ACTIVO || supabase === null) {
    // MVP sin cobro: no mutamos. Registro mínimo, sin datos sensibles.
    console.log(
      `[scaffold] suscripción ${stripeSubscriptionId} → ${estado} (mutación desactivada: COBRO_ACTIVO=false)`,
    );
    return;
  }

  // --- Rama de cobro real (fase posterior) ---------------------------------
  // Actualiza la fila existente por `stripe_subscription_id`. No crea clientes
  // ni suscripciones desde el webhook.
  const cambios: Record<string, unknown> = { status: estado };
  if (periodo.start !== null) cambios.current_period_start = periodo.start;
  if (periodo.end !== null) cambios.current_period_end = periodo.end;

  const { error } = await supabase
    .from("subscriptions")
    .update(cambios)
    .eq("stripe_subscription_id", stripeSubscriptionId);
  if (error) {
    throw new Error(`no se pudo actualizar la suscripción: ${error.message}`);
  }
}

/** Handler de `customer.subscription.created|updated|deleted`. */
async function manejarSuscripcion(
  supabase: SupabaseClient | null,
  objeto: unknown,
  eliminado: boolean,
): Promise<void> {
  const crudo = comoObjeto(objeto);
  const id = crudo.id;
  const estadoStripe = crudo.status;
  if (typeof id !== "string" || typeof estadoStripe !== "string") {
    // Evento sin los campos mínimos: lo ignoramos (idempotente, no rompemos).
    console.log("[scaffold] evento de suscripción sin id/status; ignorado");
    return;
  }

  const sub = crudo as unknown as StripeSubscriptionObject;
  // `deleted` fuerza el estado cancelado aunque Stripe reporte otro valor.
  const estado: SubscriptionStatus = eliminado ? "canceled" : mapearEstado(sub.status);

  await actualizarSuscripcion(supabase, id, estado, {
    start: epochAIso(sub.current_period_start),
    end: epochAIso(sub.current_period_end),
  });
}

/** Handler de `invoice.payment_failed`. */
async function manejarPagoFallido(
  supabase: SupabaseClient | null,
  objeto: unknown,
): Promise<void> {
  const invoice = comoObjeto(objeto) as unknown as StripeInvoiceObject;
  const stripeSubscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : null;
  if (stripeSubscriptionId === null) {
    console.log("[scaffold] invoice.payment_failed sin subscription; ignorado");
    return;
  }
  // Un pago fallido marca la suscripción como `past_due` (cuando el cobro esté
  // activo). En el MVP solo se registra.
  await actualizarSuscripcion(supabase, stripeSubscriptionId, "past_due", {
    start: null,
    end: null,
  });
}

// --- Enrutamiento por tipo de evento ---------------------------------------

async function enrutarEvento(
  supabase: SupabaseClient | null,
  evento: StripeEvent,
): Promise<void> {
  const objeto = evento.data.object;
  switch (evento.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await manejarSuscripcion(supabase, objeto, false);
      break;
    case "customer.subscription.deleted":
      await manejarSuscripcion(supabase, objeto, true);
      break;
    case "invoice.payment_failed":
      await manejarPagoFallido(supabase, objeto);
      break;
    default:
      // Otros tipos: aceptados (200) pero sin acción. No los procesamos.
      console.log(`[scaffold] evento ${evento.type} sin handler; sin acción`);
  }
}

// --- Servidor HTTP ---------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "método no permitido" }, 405);
  }

  const cfg = leerConfig();

  // Sin secreto no podemos verificar la firma: sería un endpoint abierto.
  if (cfg.webhookSecret === null || cfg.webhookSecret.length === 0) {
    console.error("STRIPE_WEBHOOK_SECRET no está configurado; se rechaza la invocación.");
    return jsonResponse(
      { error: "servidor mal configurado: falta STRIPE_WEBHOOK_SECRET" },
      500,
    );
  }

  // El cuerpo crudo es necesario para verificar la firma (byte a byte).
  const body = await req.text();
  const firmaHeader = req.headers.get("stripe-signature");
  if (firmaHeader === null || firmaHeader.length === 0) {
    return jsonResponse({ error: "falta la firma del webhook" }, 400);
  }

  let firmaValida = false;
  try {
    firmaValida = await verificarFirma(body, firmaHeader, cfg.webhookSecret);
  } catch (error) {
    // Un fallo en la verificación se trata como firma inválida; no se filtra.
    console.error(`Error al verificar la firma: ${resumirError(error)}`);
    firmaValida = false;
  }
  if (!firmaValida) {
    return jsonResponse({ error: "firma inválida" }, 400);
  }

  // Parseamos el evento ya con la firma verificada.
  let evento: StripeEvent;
  try {
    const parseado = comoObjeto(JSON.parse(body));
    if (typeof parseado.type !== "string" || typeof parseado.id !== "string") {
      return jsonResponse({ error: "evento inválido" }, 400);
    }
    evento = parseado as unknown as StripeEvent;
  } catch {
    return jsonResponse({ error: "cuerpo no es JSON válido" }, 400);
  }

  // Cliente service_role solo si hay credenciales (y solo se usa cuando el
  // cobro esté activo). En el MVP los handlers no mutan.
  let supabase: SupabaseClient | null = null;
  if (COBRO_ACTIVO && cfg.supabaseUrl.length > 0 && cfg.serviceRoleKey.length > 0) {
    supabase = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  try {
    await enrutarEvento(supabase, evento);
    // Respondemos 200 aunque el handler sea no-op, para que Stripe no reintente.
    return jsonResponse({ received: true }, 200);
  } catch (error) {
    // Nunca lanzamos al cliente. Registramos el tipo, nunca el cuerpo completo.
    console.error(
      `Error al procesar el evento ${evento.type} (${evento.id}): ${resumirError(error)}`,
    );
    return jsonResponse(
      { received: true, warning: "el evento se aceptó pero el handler falló" },
      200,
    );
  }
});
