import "server-only";

import type { Database } from "@dogtoralia/types";

import { createClient } from "@/lib/supabase/server";

/**
 * Consultas del panel superadmin. Todas van contra las RPCs de plataforma
 * (SECURITY DEFINER), que exigen `is_superadmin` en la base: ante 42501 se
 * devuelve un resultado vacío/neutro y la UI ya está protegida por el guard.
 * Jamás service_role en apps/web.
 */

export interface PanoramaPlataforma {
  organizaciones: { total: number; active: number; suspended: number; archived: number };
  clinicas: {
    total: number;
    trial: number;
    active: number;
    past_due: number;
    suspended: number;
    cancelled: number;
    archived: number;
  };
  veterinariosActivos: number;
  propietarios: number;
  mascotas: number;
  citas: { total: number; ultimos30Dias: number; completadas: number; canceladas: number };
}

export type FilaClinicaPlataforma =
  Database["public"]["Functions"]["platform_clinics"]["Returns"][number];
export type FilaActividadPlataforma =
  Database["public"]["Functions"]["platform_recent_activity"]["Returns"][number];

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function numero(fuente: Record<string, unknown>, clave: string): number {
  const valor = fuente[clave];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

/** Panorama global de la plataforma; null si la RPC falla (p. ej. sin permiso). */
export async function obtenerPanorama(): Promise<PanoramaPlataforma | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_overview");
  if (error || !esObjeto(data)) return null;

  const orgs = esObjeto(data.organizaciones) ? data.organizaciones : {};
  const clinicas = esObjeto(data.clinicas) ? data.clinicas : {};
  const citas = esObjeto(data.citas) ? data.citas : {};

  return {
    organizaciones: {
      total: numero(orgs, "total"),
      active: numero(orgs, "active"),
      suspended: numero(orgs, "suspended"),
      archived: numero(orgs, "archived"),
    },
    clinicas: {
      total: numero(clinicas, "total"),
      trial: numero(clinicas, "trial"),
      active: numero(clinicas, "active"),
      past_due: numero(clinicas, "past_due"),
      suspended: numero(clinicas, "suspended"),
      cancelled: numero(clinicas, "cancelled"),
      archived: numero(clinicas, "archived"),
    },
    veterinariosActivos: numero(data, "veterinarios_activos"),
    propietarios: numero(data, "propietarios"),
    mascotas: numero(data, "mascotas"),
    citas: {
      total: numero(citas, "total"),
      ultimos30Dias: numero(citas, "ultimos_30_dias"),
      completadas: numero(citas, "completadas"),
      canceladas: numero(citas, "canceladas"),
    },
  };
}

/** Listado paginado de clínicas de la plataforma. */
export async function listarClinicasPlataforma(
  opciones: { limit?: number; offset?: number } = {},
): Promise<FilaClinicaPlataforma[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_clinics", {
    p_limit: opciones.limit ?? 100,
    p_offset: opciones.offset ?? 0,
  });
  if (error) return [];
  return data ?? [];
}

/** Actividad reciente (audit_log) de la plataforma. */
export async function listarActividadPlataforma(
  opciones: { limit?: number } = {},
): Promise<FilaActividadPlataforma[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_recent_activity", {
    p_limit: opciones.limit ?? 50,
  });
  if (error) return [];
  return data ?? [];
}
