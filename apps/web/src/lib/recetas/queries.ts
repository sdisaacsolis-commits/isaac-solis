import "server-only";

import type { PrescriptionStatus, Tables } from "@dogtoralia/types";

import { hoyEnZona, localAUtc, sumarDias } from "@/lib/agenda/dates";
import { nombresDeMiembros } from "@/lib/clinica/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Consultas de recetas veterinarias. SIEMPRE con el cliente del usuario (RLS
 * decide qué filas existen; los borradores solo son visibles para los roles
 * clínicos). Nunca service_role en apps/web.
 */

export const TAMANO_PAGINA_RECETAS = 20;

export interface FilaReceta {
  receta: Tables<"prescriptions">;
  mascota: Pick<Tables<"pets">, "id" | "name" | "species"> | null;
  veterinario: string | null;
}

export async function listarRecetas(opciones: {
  clinicId: string;
  estado?: PrescriptionStatus;
  page?: number;
}): Promise<{ filas: FilaReceta[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, opciones.page ?? 1);
  const inicio = (page - 1) * TAMANO_PAGINA_RECETAS;

  let consulta = supabase
    .from("prescriptions")
    .select("*", { count: "exact" })
    .eq("clinic_id", opciones.clinicId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA_RECETAS - 1);
  if (opciones.estado) consulta = consulta.eq("status", opciones.estado);

  const { data, count } = await consulta;
  const recetas = data ?? [];
  if (recetas.length === 0) return { filas: [], total: count ?? 0 };

  const [{ data: mascotas }, veterinarios] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, species")
      .in("id", [...new Set(recetas.map((r) => r.pet_id))]),
    nombresDeMiembros(recetas.map((r) => r.prescriber_clinic_member_id)),
  ]);

  return {
    filas: recetas.map((receta) => ({
      receta,
      mascota: mascotas?.find((m) => m.id === receta.pet_id) ?? null,
      veterinario: veterinarios.get(receta.prescriber_clinic_member_id) ?? null,
    })),
    total: count ?? 0,
  };
}

export interface DetalleReceta {
  receta: Tables<"prescriptions">;
  partidas: Tables<"prescription_items">[];
  documento: Tables<"prescription_documents"> | null;
  historial: Tables<"prescription_status_history">[];
  mascota: Tables<"pets"> | null;
  propietario: Pick<Tables<"pet_owners">, "id" | "display_name"> | null;
  consulta: Pick<Tables<"clinical_encounters">, "id" | "folio" | "status"> | null;
  veterinario: string | null;
  cedulaVeterinario: string | null;
  /** Folio de la receta a la que sustituye (si aplica). */
  folioSustituida: string | null;
  /** Receta sustituta (id + folio) si esta fue sustituida. */
  sustituta: { id: string; folio: string | null } | null;
}

export async function obtenerReceta(id: string): Promise<DetalleReceta | null> {
  const supabase = await createClient();
  const { data: receta } = await supabase
    .from("prescriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!receta) return null;

  const [
    { data: partidas },
    { data: documento },
    { data: historial },
    { data: mascota },
    { data: propietario },
    { data: consulta },
    veterinarios,
    { data: miembro },
    { data: original },
    { data: sustituta },
  ] = await Promise.all([
    supabase
      .from("prescription_items")
      .select("*")
      .eq("prescription_id", id)
      .order("position")
      .order("created_at"),
    supabase.from("prescription_documents").select("*").eq("prescription_id", id).maybeSingle(),
    supabase
      .from("prescription_status_history")
      .select("*")
      .eq("prescription_id", id)
      .order("created_at"),
    supabase.from("pets").select("*").eq("id", receta.pet_id).maybeSingle(),
    supabase
      .from("pet_owners")
      .select("id, display_name")
      .eq("id", receta.responsible_owner_id)
      .maybeSingle(),
    supabase
      .from("clinical_encounters")
      .select("id, folio, status")
      .eq("id", receta.encounter_id)
      .maybeSingle(),
    nombresDeMiembros([receta.prescriber_clinic_member_id]),
    supabase
      .from("clinic_members")
      .select("professional_license")
      .eq("id", receta.prescriber_clinic_member_id)
      .maybeSingle(),
    receta.supersedes_prescription_id
      ? supabase
          .from("prescriptions")
          .select("id, folio")
          .eq("id", receta.supersedes_prescription_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    receta.superseded_by_prescription_id
      ? supabase
          .from("prescriptions")
          .select("id, folio")
          .eq("id", receta.superseded_by_prescription_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    receta,
    partidas: partidas ?? [],
    documento: documento ?? null,
    historial: historial ?? [],
    mascota: mascota ?? null,
    propietario: propietario ?? null,
    consulta: consulta ?? null,
    veterinario: veterinarios.get(receta.prescriber_clinic_member_id) ?? null,
    cedulaVeterinario: miembro?.professional_license ?? null,
    folioSustituida: original?.folio ?? null,
    sustituta: sustituta ? { id: sustituta.id, folio: sustituta.folio } : null,
  };
}

export async function recetasDeMascota(opciones: {
  petId: string;
  clinicId: string;
  page?: number;
}): Promise<{ filas: FilaReceta[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, opciones.page ?? 1);
  const inicio = (page - 1) * TAMANO_PAGINA_RECETAS;

  const { data, count } = await supabase
    .from("prescriptions")
    .select("*", { count: "exact" })
    .eq("pet_id", opciones.petId)
    .eq("clinic_id", opciones.clinicId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA_RECETAS - 1);
  const recetas = data ?? [];
  if (recetas.length === 0) return { filas: [], total: count ?? 0 };

  const veterinarios = await nombresDeMiembros(recetas.map((r) => r.prescriber_clinic_member_id));
  return {
    filas: recetas.map((receta) => ({
      receta,
      mascota: null,
      veterinario: veterinarios.get(receta.prescriber_clinic_member_id) ?? null,
    })),
    total: count ?? 0,
  };
}

export interface ConsultaParaReceta {
  id: string;
  folio: string;
  finalizedAt: string | null;
  mascota: string;
}

/** Consultas finalizadas recientes de la clínica, para el selector de nueva receta. */
export async function consultasFinalizablesParaReceta(
  clinicId: string,
): Promise<ConsultaParaReceta[]> {
  const supabase = await createClient();
  const { data: consultas } = await supabase
    .from("clinical_encounters")
    .select("id, folio, finalized_at, pet_id")
    .eq("clinic_id", clinicId)
    .eq("status", "finalized")
    .is("deleted_at", null)
    .order("finalized_at", { ascending: false })
    .limit(30);
  if (!consultas || consultas.length === 0) return [];

  const { data: mascotas } = await supabase
    .from("pets")
    .select("id, name")
    .in("id", [...new Set(consultas.map((c) => c.pet_id))]);

  return consultas.map((c) => ({
    id: c.id,
    folio: c.folio,
    finalizedAt: c.finalized_at,
    mascota: mascotas?.find((m) => m.id === c.pet_id)?.name ?? "—",
  }));
}

export interface MetricasRecetas {
  emitidasHoy: number;
  borradores: number;
  anuladas: number;
}

export async function metricasRecetas(
  clinicId: string,
  timezone: string,
): Promise<MetricasRecetas> {
  const supabase = await createClient();
  const hoy = hoyEnZona(timezone);
  const inicioHoy = localAUtc(`${hoy}T00:00`, timezone).toISOString();
  const finHoy = localAUtc(`${sumarDias(hoy, 1)}T00:00`, timezone).toISOString();

  const base = () =>
    supabase
      .from("prescriptions")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .is("deleted_at", null);

  const [emitidasRes, borradoresRes, anuladasRes] = await Promise.all([
    base().eq("status", "issued").gte("issued_at", inicioHoy).lt("issued_at", finHoy),
    base().eq("status", "draft"),
    base().eq("status", "voided"),
  ]);

  return {
    emitidasHoy: emitidasRes.count ?? 0,
    borradores: borradoresRes.count ?? 0,
    anuladas: anuladasRes.count ?? 0,
  };
}
