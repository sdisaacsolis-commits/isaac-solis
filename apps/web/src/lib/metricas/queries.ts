import "server-only";

import { hoyEnZona } from "@/lib/agenda/dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Métricas de agenda para el dashboard de la clínica. Se apoyan en la RPC
 * `clinic_appointment_metrics` (SECURITY DEFINER en la base), que solo responde
 * al personal operativo de la clínica; ante 42501 (sin permiso) devolvemos null
 * y la UI simplemente oculta la sección. Nunca service_role en apps/web.
 */

export interface MetricasAgendaMes {
  totalPeriodo: number;
  completadas: number;
  canceladas: number;
  noShow: number;
  hoy: number;
  porConfirmar: number;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

/**
 * Métricas del MES EN CURSO calculado en la zona de la clínica (CLAUDE.md §13:
 * el rango se decide en hora local y la BD trabaja en UTC). Devuelve null si la
 * RPC falla (p. ej. el usuario no es personal operativo de esa clínica).
 */
export async function obtenerMetricasAgenda(
  clinicId: string,
  timezone: string,
): Promise<MetricasAgendaMes | null> {
  const supabase = await createClient();

  const hoy = hoyEnZona(timezone); // "YYYY-MM-DD" en la zona de la clínica
  const anioMes = hoy.slice(0, 7); // "YYYY-MM"
  const [anio, mes] = anioMes.split("-").map(Number);
  const primerDia = `${anioMes}-01`;
  // Día 0 del mes siguiente (mes es 1-based) = último día del mes en curso.
  const ultimoDia = new Date(Date.UTC(anio ?? 1970, mes ?? 1, 0)).toISOString().slice(0, 10);

  const { data, error } = await supabase.rpc("clinic_appointment_metrics", {
    p_clinic_id: clinicId,
    p_from: primerDia,
    p_to: ultimoDia,
  });

  if (error) return null;
  if (!esObjeto(data)) return null;

  return {
    totalPeriodo: numero(data.total_periodo),
    completadas: numero(data.completadas),
    canceladas: numero(data.canceladas),
    noShow: numero(data.no_show),
    hoy: numero(data.hoy),
    porConfirmar: numero(data.por_confirmar),
  };
}
