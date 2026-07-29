import "server-only";

import type { Database } from "@dogtoralia/types";

import { createClient } from "@/lib/supabase/server";

/**
 * Consultas de suscripciones para el panel de clínica.
 *
 * `clinic_current_plan` es una RPC STABLE SECURITY DEFINER (grant a
 * authenticated) que solo el personal operativo puede leer; devuelve `jsonb`.
 * Aquí lo tipamos con una interfaz local y acceso defensivo (sin `any`): si la
 * RPC falla o el jsonb no tiene la forma esperada, devolvemos `null` y la UI
 * simplemente omite la tarjeta. La autoridad de datos vive en la base (RLS).
 */

export type EstadoSuscripcion = Database["public"]["Enums"]["subscription_status"];

const ESTADOS_SUSCRIPCION: readonly EstadoSuscripcion[] = [
  "trialing",
  "active",
  "past_due",
  "canceled",
];

export interface PlanDeClinica {
  planCode: string;
  planName: string;
  status: EstadoSuscripcion;
  includedVeterinarians: number;
  priceCents: number;
  /** Banderas de funcionalidades del plan; forma libre definida por la base. */
  features: Record<string, unknown>;
  /** `false` si la clínica superó los veterinarios incluidos en su plan. */
  withinVeterinarianLimit: boolean;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function cadena(fuente: Record<string, unknown>, clave: string): string | null {
  const valor = fuente[clave];
  return typeof valor === "string" ? valor : null;
}

function numero(fuente: Record<string, unknown>, clave: string): number {
  const valor = fuente[clave];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function esEstado(valor: unknown): valor is EstadoSuscripcion {
  return typeof valor === "string" && ESTADOS_SUSCRIPCION.includes(valor as EstadoSuscripcion);
}

/**
 * Plan vigente de la clínica activa. Devuelve `null` si no hay suscripción,
 * si la RPC falla (p. ej. sin permiso) o si el jsonb no tiene la forma esperada.
 */
export async function obtenerPlanDeClinica(clinicId: string): Promise<PlanDeClinica | null> {
  const supabase = await createClient();

  const [plan, limite] = await Promise.all([
    supabase.rpc("clinic_current_plan", { p_clinic_id: clinicId }),
    supabase.rpc("clinic_within_veterinarian_limit", { p_clinic_id: clinicId }),
  ]);

  if (plan.error || !esObjeto(plan.data)) return null;

  const planCode = cadena(plan.data, "plan_code");
  const planName = cadena(plan.data, "plan_name");
  const status = plan.data["status"];
  if (planCode === null || planName === null || !esEstado(status)) return null;

  const features = esObjeto(plan.data["features"]) ? plan.data["features"] : {};

  return {
    planCode,
    planName,
    status,
    includedVeterinarians: numero(plan.data, "included_veterinarians"),
    priceCents: numero(plan.data, "price_cents"),
    features,
    // Ante error de la RPC de límite, asumimos dentro del límite (no alarmar).
    withinVeterinarianLimit: limite.error ? true : limite.data !== false,
  };
}
