import "server-only";

import type { ServiceCategory } from "@dogtoralia/types";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas del sitio público (Fase 8). REGLA DURA: las rutas públicas SOLO
 * usan las RPCs curadas (SECURITY DEFINER) con el cliente anon/ssr; jamás
 * `.from()` sobre tablas base. Sin Supabase configurado, todo degrada a
 * estados vacíos (mismo criterio que el resto de la app).
 */

export interface ClinicaPublicaResumen {
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  description: string | null;
  accepts_online_booking: boolean;
  services_count: number;
  price_from_cents: number | null;
}

export interface ServicioPublico {
  id: string;
  name: string;
  category: ServiceCategory;
  duration_minutes: number;
  price_cents: number;
  description: string | null;
}

export interface VeterinarioDeClinicaPublica {
  clinic_member_id: string;
  display_name: string | null;
  professional_license: string | null;
  profile_slug: string | null;
}

export interface ClinicaPublica {
  slug: string;
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  timezone: string;
  accepts_online_booking: boolean;
  services: ServicioPublico[];
  veterinarians: VeterinarioDeClinicaPublica[];
}

export interface ClinicaDeVeterinarioPublico {
  clinic_slug: string;
  clinic_name: string;
  city: string | null;
  state: string | null;
  accepts_online_booking: boolean;
  clinic_member_id: string;
  professional_license: string | null;
}

export interface VeterinarioPublico {
  slug: string;
  headline: string | null;
  bio: string | null;
  display_name: string | null;
  clinics: ClinicaDeVeterinarioPublico[];
}

export interface CiudadPublica {
  city: string;
  clinics: number;
}

export interface HuecoPublico {
  slot_start: string;
  slot_end: string;
}

export interface FiltrosBusquedaPublica {
  q?: string;
  ciudad?: string;
  categoria?: ServiceCategory;
  limit?: number;
  offset?: number;
}

export async function buscarClinicasPublicas(
  filtros: FiltrosBusquedaPublica,
): Promise<ClinicaPublicaResumen[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_public_clinics", {
    p_q: filtros.q,
    p_city: filtros.ciudad,
    p_category: filtros.categoria,
    p_limit: filtros.limit ?? 20,
    p_offset: filtros.offset ?? 0,
  });
  if (error || !data) return [];
  return data as unknown as ClinicaPublicaResumen[];
}

export async function obtenerClinicaPublica(slug: string): Promise<ClinicaPublica | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_clinic", { p_slug: slug });
  if (error || !data) return null;
  return data as unknown as ClinicaPublica;
}

export async function obtenerVeterinarioPublico(slug: string): Promise<VeterinarioPublico | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_veterinarian", { p_slug: slug });
  if (error || !data) return null;
  return data as unknown as VeterinarioPublico;
}

export async function listarCiudadesPublicas(): Promise<CiudadPublica[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_cities");
  if (error || !data) return [];
  return data as unknown as CiudadPublica[];
}

/** Huecos reales del widget público; null cuando la clínica no es reservable. */
export async function obtenerHuecosPublicos(consulta: {
  clinicSlug: string;
  serviceId: string;
  veterinarianMemberId: string;
  from: string;
  to: string;
}): Promise<HuecoPublico[] | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_available_slots", {
    p_clinic_slug: consulta.clinicSlug,
    p_service_id: consulta.serviceId,
    p_veterinarian_clinic_member_id: consulta.veterinarianMemberId,
    p_from: consulta.from,
    p_to: consulta.to,
  });
  if (error || !data) return null;
  return data as unknown as HuecoPublico[];
}

/** "Ciudad de México" → "ciudad-de-mexico" (URLs SEO de directorios). */
export function slugificarCiudad(ciudad: string): string {
  return ciudad
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resuelve el segmento de URL de una ciudad contra las ciudades públicas reales. */
export async function resolverCiudadPublica(segmento: string): Promise<CiudadPublica | null> {
  const ciudades = await listarCiudadesPublicas();
  return ciudades.find((c) => slugificarCiudad(c.city) === segmento.toLowerCase()) ?? null;
}
