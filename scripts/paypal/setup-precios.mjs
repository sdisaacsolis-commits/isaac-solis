#!/usr/bin/env node
/**
 * Alta idempotente del catálogo de Dogtoralia en PayPal (Fase 14).
 *
 * Crea (si no existen) el producto `DOGTORALIA-MEMBRESIA` y los planes con
 * nombre estable que el panel resuelve al iniciar el checkout:
 *   profesional_mensual  $599.00 MXN / mes
 *   profesional_anual    $5,990.00 MXN / año
 * IVA: 16% exclusivo (taxes.percentage=16, inclusive=false) — PayPal lo suma.
 * Los veterinarios adicionales NO son un plan: el panel sobrescribe el precio
 * del ciclo por suscripción (base + $399/vet mensual o $3,990/vet anual).
 *
 * También asegura el webhook apuntando a la Edge Function `paypal-webhook`
 * con los eventos de suscripción y pago, e imprime su WEBHOOK_ID (va como
 * secreto PAYPAL_WEBHOOK_ID de la función).
 *
 * Uso:
 *   PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... [PAYPAL_MODE=live|sandbox] \
 *     node scripts/paypal/setup-precios.mjs
 */

const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
const modo = process.env.PAYPAL_MODE ?? "live";

if (!clientId || !clientSecret) {
  console.error("Faltan PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET. Aborto sin cambios.");
  process.exit(1);
}

const API = modo === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
const PRODUCTO_ID = "DOGTORALIA-MEMBRESIA";
const WEBHOOK_URL = "https://izixhghxlmsfjwsbohxt.functions.supabase.co/paypal-webhook";

const PLANES = [
  { nombre: "profesional_mensual", monto: "599.00", intervalo: "MONTH" },
  { nombre: "profesional_anual", monto: "5990.00", intervalo: "YEAR" },
];

const EVENTOS_WEBHOOK = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.RE-ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "PAYMENT.SALE.COMPLETED",
];

let token;

async function paypal(ruta, { method = "GET", body, aceptar404 = false } = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (aceptar404 && respuesta.status === 404) return null;
  const texto = await respuesta.text();
  const cuerpo = texto.length > 0 ? JSON.parse(texto) : {};
  if (!respuesta.ok) {
    const mensaje = cuerpo?.message ?? `HTTP ${respuesta.status}`;
    throw new Error(`PayPal ${method} ${ruta}: ${mensaje}`);
  }
  return cuerpo;
}

async function autenticar() {
  const respuesta = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok || !cuerpo.access_token) {
    throw new Error("PayPal no autenticó las credenciales (revisa modo live/sandbox).");
  }
  token = cuerpo.access_token;
}

async function asegurarProducto() {
  const existente = await paypal(`/v1/catalogs/products/${PRODUCTO_ID}`, { aceptar404: true });
  if (existente) {
    console.log(`producto ${PRODUCTO_ID}: ya existe`);
    return;
  }
  await paypal("/v1/catalogs/products", {
    method: "POST",
    body: {
      id: PRODUCTO_ID,
      name: "Dogtoralia — Membresía Profesional",
      description:
        "Membresía por clínica veterinaria: agenda, expediente, recetas, vacunación y perfil público. 1 veterinario incluido.",
      type: "SERVICE",
      category: "SOFTWARE",
    },
  });
  console.log(`producto ${PRODUCTO_ID}: creado`);
}

async function asegurarPlanes() {
  const lista = await paypal(`/v1/billing/plans?product_id=${PRODUCTO_ID}&page_size=20`);
  const existentes = new Map((lista.plans ?? []).map((p) => [p.name, p]));
  for (const plan of PLANES) {
    const actual = existentes.get(plan.nombre);
    if (actual && actual.status === "ACTIVE") {
      console.log(`plan ${plan.nombre}: ya existe (${actual.id})`);
      continue;
    }
    const creado = await paypal("/v1/billing/plans", {
      method: "POST",
      body: {
        product_id: PRODUCTO_ID,
        name: plan.nombre,
        description: "Precio base por clínica; veterinarios adicionales por override de precio.",
        billing_cycles: [
          {
            frequency: { interval_unit: plan.intervalo, interval_count: 1 },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: { fixed_price: { currency_code: "MXN", value: plan.monto } },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 2,
        },
        taxes: { percentage: "16", inclusive: false },
      },
    });
    console.log(`plan ${plan.nombre}: creado (${creado.id})`);
  }
}

async function asegurarWebhook() {
  const lista = await paypal("/v1/notifications/webhooks");
  const actual = (lista.webhooks ?? []).find((w) => w.url === WEBHOOK_URL);
  if (actual) {
    console.log(`webhook: ya existe → PAYPAL_WEBHOOK_ID=${actual.id}`);
    return;
  }
  const creado = await paypal("/v1/notifications/webhooks", {
    method: "POST",
    body: {
      url: WEBHOOK_URL,
      event_types: EVENTOS_WEBHOOK.map((name) => ({ name })),
    },
  });
  console.log(`webhook: creado → PAYPAL_WEBHOOK_ID=${creado.id}`);
}

await autenticar();
await asegurarProducto();
await asegurarPlanes();
await asegurarWebhook();
console.log("Catálogo de PayPal listo. Guarda el PAYPAL_WEBHOOK_ID como secreto de la función.");
