import "server-only";

import type { Database } from "@dogtoralia/types";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas de facturación. El catálogo público llega por la RPC curada
 * `list_public_plans` (regla de rutas públicas: nunca `.from()` en ellas);
 * la suscripción de la clínica se lee por RLS con la sesión del usuario.
 */

export interface PlanPublico {
  code: string;
  name: string;
  priceCents: number;
  billingInterval: "month" | "year";
  includedVeterinarians: number;
  additionalVeterinarianPriceCents: number | null;
}

function esIntervalo(valor: unknown): valor is "month" | "year" {
  return valor === "month" || valor === "year";
}

/** Planes comerciales activos, en orden de precio (para /precios y el panel). */
export async function listarPlanesPublicos(): Promise<PlanPublico[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_plans");
  if (error || !Array.isArray(data)) return [];

  const planes: PlanPublico[] = [];
  for (const fila of data) {
    if (
      typeof fila.code === "string" &&
      typeof fila.name === "string" &&
      typeof fila.price_cents === "number" &&
      esIntervalo(fila.billing_interval) &&
      typeof fila.included_veterinarians === "number"
    ) {
      planes.push({
        code: fila.code,
        name: fila.name,
        priceCents: fila.price_cents,
        billingInterval: fila.billing_interval,
        includedVeterinarians: fila.included_veterinarians,
        additionalVeterinarianPriceCents:
          typeof fila.additional_veterinarian_price_cents === "number"
            ? fila.additional_veterinarian_price_cents
            : null,
      });
    }
  }
  return planes;
}

export interface SuscripcionDeClinica {
  status: Database["public"]["Enums"]["subscription_status"];
  currentPeriodEnd: string | null;
}

/** Suscripción de la clínica activa (RLS: solo personal de la clínica). */
export async function obtenerSuscripcionDeClinica(
  clinicId: string,
): Promise<SuscripcionDeClinica | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error || data === null) return null;
  return { status: data.status, currentPeriodEnd: data.current_period_end };
}
