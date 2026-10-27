import "server-only";

import type { PlanCode } from "@dogtoralia/validation";

import { env } from "@/env";
import { logOperational } from "@/lib/log";

import type { ParametrosCheckout, ProveedorDePagos, SesionDeCobro } from "./types";

/**
 * Proveedor Stripe detrás de la interfaz `ProveedorDePagos` (18b). Usa la API
 * REST con `fetch` en lugar del SDK: el flujo necesario (resolver precios por
 * lookup key y crear una sesión de Checkout) son dos llamadas form-encoded, y
 * así no agregamos una dependencia que el resto del dominio no debe conocer.
 *
 * Los precios se resuelven por `lookup_key` (no por IDs quemados): el script
 * `scripts/stripe/setup-precios.mjs` crea los productos/precios con estas
 * llaves en la cuenta de Stripe. Errores con código estable; nunca se registra
 * la llave ni datos del cliente.
 */

const STRIPE_API = "https://api.stripe.com/v1";

/** Llaves de búsqueda de precios en Stripe por plan del catálogo. */
const LOOKUP_KEYS: Record<PlanCode, { base: string; vetAdicional: string }> = {
  profesional: { base: "profesional_mensual", vetAdicional: "vet_adicional_mensual" },
  profesional_anual: { base: "profesional_anual", vetAdicional: "vet_adicional_anual" },
};

interface StripePrice {
  id: string;
  lookup_key: string | null;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

async function llamarStripe(
  secretKey: string,
  ruta: string,
  init: { method: "GET" } | { method: "POST"; body: URLSearchParams },
): Promise<unknown> {
  const respuesta = await fetch(`${STRIPE_API}${ruta}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${secretKey}`,
      ...(init.method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init.method === "POST" ? init.body : undefined,
    cache: "no-store",
  });
  const cuerpo: unknown = await respuesta.json();
  if (!respuesta.ok) {
    const mensaje =
      esObjeto(cuerpo) &&
      esObjeto(cuerpo["error"]) &&
      typeof cuerpo["error"]["message"] === "string"
        ? cuerpo["error"]["message"]
        : `HTTP ${respuesta.status}`;
    throw new Error(`CHECKOUT_FALLIDO: Stripe respondió con error (${mensaje}).`);
  }
  return cuerpo;
}

/** Resuelve los IDs de precio activos para un plan por sus lookup keys. */
async function resolverPrecios(
  secretKey: string,
  planCode: PlanCode,
): Promise<{ base: string; vetAdicional: string }> {
  const llaves = LOOKUP_KEYS[planCode];
  const query = new URLSearchParams({ active: "true", limit: "10" });
  query.append("lookup_keys[]", llaves.base);
  query.append("lookup_keys[]", llaves.vetAdicional);

  const cuerpo = await llamarStripe(secretKey, `/prices?${query.toString()}`, { method: "GET" });
  const datos = esObjeto(cuerpo) && Array.isArray(cuerpo["data"]) ? cuerpo["data"] : [];
  const precios = new Map<string, string>();
  for (const fila of datos) {
    if (
      esObjeto(fila) &&
      typeof fila["id"] === "string" &&
      typeof fila["lookup_key"] === "string"
    ) {
      const precio: StripePrice = { id: fila["id"], lookup_key: fila["lookup_key"] };
      if (precio.lookup_key !== null) precios.set(precio.lookup_key, precio.id);
    }
  }

  const base = precios.get(llaves.base);
  const vetAdicional = precios.get(llaves.vetAdicional);
  if (base === undefined || vetAdicional === undefined) {
    throw new Error(
      `PRECIOS_NO_ENCONTRADOS: faltan precios en Stripe para el plan ${planCode} ` +
        "(ejecutar scripts/stripe/setup-precios.mjs).",
    );
  }
  return { base, vetAdicional };
}

export const proveedorStripe: ProveedorDePagos = {
  async crearSesionCheckout(params: ParametrosCheckout): Promise<SesionDeCobro> {
    const secretKey = env.STRIPE_SECRET_KEY;
    if (secretKey === undefined) {
      throw new Error("FACTURACION_NO_CONFIGURADA: falta STRIPE_SECRET_KEY en el servidor.");
    }

    const precios = await resolverPrecios(secretKey, params.planCode);

    const cuerpo = new URLSearchParams({
      mode: "subscription",
      client_reference_id: params.clinicId,
      success_url: params.urlExito,
      cancel_url: params.urlCancelacion,
      "metadata[clinic_id]": params.clinicId,
      "metadata[plan_code]": params.planCode,
      "subscription_data[metadata][clinic_id]": params.clinicId,
      "subscription_data[metadata][plan_code]": params.planCode,
      "line_items[0][price]": precios.base,
      "line_items[0][quantity]": "1",
    });
    if (params.veterinariosAdicionales > 0) {
      cuerpo.set("line_items[1][price]", precios.vetAdicional);
      cuerpo.set("line_items[1][quantity]", String(params.veterinariosAdicionales));
    }
    if (params.correoCliente !== null) {
      cuerpo.set("customer_email", params.correoCliente);
    }

    const sesion = await llamarStripe(secretKey, "/checkout/sessions", {
      method: "POST",
      body: cuerpo,
    });
    const url = esObjeto(sesion) && typeof sesion["url"] === "string" ? sesion["url"] : null;
    if (url === null) {
      logOperational("facturacion.checkout_sin_url", { plan: params.planCode });
      throw new Error("CHECKOUT_FALLIDO: el proveedor no devolvió la URL del checkout.");
    }
    return { url };
  },
};
