import "server-only";

import type { PlanCode } from "@dogtoralia/validation";

import { env } from "@/env";
import { logOperational } from "@/lib/log";

import type { ParametrosCheckout, ProveedorDePagos, SesionDeCobro } from "./types";

/**
 * Proveedor PayPal detrás de la interfaz `ProveedorDePagos` (18b), por la API
 * REST de Subscriptions con `fetch` (igual criterio que el proveedor Stripe:
 * sin SDK). El catálogo lo crea `scripts/paypal/setup-precios.mjs` con un
 * producto de id fijo y planes con nombre estable; aquí se resuelven por ese
 * nombre. Los veterinarios adicionales se cobran con el override de precio por
 * suscripción (`plan.billing_cycles[].pricing_scheme.fixed_price`): el total
 * es base + adicionales, sin IVA (el plan declara taxes 16% exclusivo).
 */

/** Id fijo del producto en el catálogo de PayPal (lo crea el script de alta). */
export const PAYPAL_PRODUCT_ID = "DOGTORALIA-MEMBRESIA";

/** Nombres estables de los planes en PayPal, por plan del catálogo propio. */
export const PAYPAL_PLAN_NAMES: Record<PlanCode, string> = {
  profesional: "profesional_mensual",
  profesional_anual: "profesional_anual",
};

/** Centavos MXN de cada plan y su veterinario adicional (espejo de la BD). */
const PRECIOS_CENTAVOS: Record<PlanCode, { base: number; vetAdicional: number }> = {
  profesional: { base: 59900, vetAdicional: 39900 },
  profesional_anual: { base: 599000, vetAdicional: 399000 },
};

function baseUrl(): string {
  return env.PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Centavos → monto decimal de PayPal ("1018.00"). */
function centavosAMonto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

async function obtenerToken(clientId: string, clientSecret: string): Promise<string> {
  const respuesta = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });
  const cuerpo: unknown = await respuesta.json();
  const token =
    esObjeto(cuerpo) && typeof cuerpo["access_token"] === "string" ? cuerpo["access_token"] : null;
  if (!respuesta.ok || token === null) {
    throw new Error("CHECKOUT_FALLIDO: PayPal no autenticó las credenciales.");
  }
  return token;
}

/** Resuelve el id del plan de PayPal por su nombre estable dentro del producto. */
async function resolverPlan(token: string, planCode: PlanCode): Promise<string> {
  const query = new URLSearchParams({
    product_id: PAYPAL_PRODUCT_ID,
    page_size: "20",
  });
  const respuesta = await fetch(`${baseUrl()}/v1/billing/plans?${query.toString()}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const cuerpo: unknown = await respuesta.json();
  const planes = esObjeto(cuerpo) && Array.isArray(cuerpo["plans"]) ? cuerpo["plans"] : [];
  for (const plan of planes) {
    if (
      esObjeto(plan) &&
      plan["name"] === PAYPAL_PLAN_NAMES[planCode] &&
      plan["status"] === "ACTIVE" &&
      typeof plan["id"] === "string"
    ) {
      return plan["id"];
    }
  }
  throw new Error(
    `PLAN_PAYPAL_NO_ENCONTRADO: falta el plan ${PAYPAL_PLAN_NAMES[planCode]} en PayPal ` +
      "(ejecutar scripts/paypal/setup-precios.mjs).",
  );
}

export const proveedorPaypal: ProveedorDePagos = {
  async crearSesionCheckout(params: ParametrosCheckout): Promise<SesionDeCobro> {
    const clientId = env.PAYPAL_CLIENT_ID;
    const clientSecret = env.PAYPAL_CLIENT_SECRET;
    if (clientId === undefined || clientSecret === undefined) {
      throw new Error(
        "FACTURACION_NO_CONFIGURADA: faltan PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET en el servidor.",
      );
    }

    const token = await obtenerToken(clientId, clientSecret);
    const planId = await resolverPlan(token, params.planCode);

    const precios = PRECIOS_CENTAVOS[params.planCode];
    const totalCentavos = precios.base + precios.vetAdicional * params.veterinariosAdicionales;

    const cuerpo: Record<string, unknown> = {
      plan_id: planId,
      custom_id: params.clinicId,
      application_context: {
        brand_name: "Dogtoralia",
        locale: "es-MX",
        user_action: "SUBSCRIBE_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: params.urlExito,
        cancel_url: params.urlCancelacion,
      },
    };
    // Con veterinarios adicionales, el precio del ciclo se sobrescribe para
    // ESTA suscripción (el plan del catálogo no cambia).
    if (params.veterinariosAdicionales > 0) {
      cuerpo.plan = {
        billing_cycles: [
          {
            sequence: 1,
            pricing_scheme: {
              fixed_price: { currency_code: "MXN", value: centavosAMonto(totalCentavos) },
            },
          },
        ],
      };
    }
    if (params.correoCliente !== null) {
      cuerpo.subscriber = { email_address: params.correoCliente };
    }

    const respuesta = await fetch(`${baseUrl()}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    });
    const sesion: unknown = await respuesta.json();
    if (!respuesta.ok) {
      const mensaje =
        esObjeto(sesion) && typeof sesion["message"] === "string"
          ? sesion["message"]
          : `HTTP ${respuesta.status}`;
      throw new Error(`CHECKOUT_FALLIDO: PayPal respondió con error (${mensaje}).`);
    }

    // El enlace de aprobación viene en links[] con rel "approve".
    const links = esObjeto(sesion) && Array.isArray(sesion["links"]) ? sesion["links"] : [];
    for (const link of links) {
      if (
        esObjeto(link) &&
        typeof link["rel"] === "string" &&
        link["rel"].toLowerCase().includes("approve") &&
        typeof link["href"] === "string"
      ) {
        return { url: link["href"] };
      }
    }
    logOperational("facturacion.paypal_sin_approve", { plan: params.planCode });
    throw new Error("CHECKOUT_FALLIDO: PayPal no devolvió el enlace de aprobación.");
  },
};
