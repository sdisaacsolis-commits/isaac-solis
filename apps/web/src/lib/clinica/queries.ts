import "server-only";

import type { EncounterStatus, EncounterType, Tables } from "@dogtoralia/types";

import { hoyEnZona, localAUtc, sumarDias } from "@/lib/agenda/dates";
import type { FilaCita } from "@/lib/agenda/queries";
import { listarCitas } from "@/lib/agenda/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Consultas del expediente clínico. SIEMPRE con el cliente del usuario (RLS
 * decide qué filas existen); nunca service_role en apps/web. Recepción ve la
 * cabecera de la consulta, pero RLS le oculta las tablas hijas: todas las
 * consultas de este módulo toleran resultados vacíos sin fallar.
 */

export const TAMANO_PAGINA_CONSULTAS = 20;

/** Estados de cita que aparecen en la sala de espera del día. */
const ESTADOS_SALA_DE_ESPERA = ["confirmed", "checked_in", "in_progress"] as const;

/** Citas de HOY listas para atenderse (confirmadas, en recepción o en atención). */
export async function listarSalaDeEspera(clinicId: string, timezone: string): Promise<FilaCita[]> {
  const hoy = hoyEnZona(timezone);
  const filas = await listarCitas({
    clinicId,
    timezone,
    desde: hoy,
    hasta: sumarDias(hoy, 1),
  });
  return filas.filter(({ cita }) =>
    (ESTADOS_SALA_DE_ESPERA as readonly string[]).includes(cita.status),
  );
}

/** Nombres visibles de miembros de clínica (vía la vista de colegas). */
export async function nombresDeMiembros(memberIds: string[]): Promise<Map<string, string>> {
  const nombres = new Map<string, string>();
  const ids = [...new Set(memberIds)].filter(Boolean);
  if (ids.length === 0) return nombres;

  const supabase = await createClient();
  const { data: miembros } = await supabase
    .from("clinic_members")
    .select("id, user_id")
    .in("id", ids);
  if (!miembros || miembros.length === 0) return nombres;

  const { data: perfiles } = await supabase
    .from("colleague_profiles")
    .select("id, display_name, first_name, last_name")
    .in(
      "id",
      miembros.map((m) => m.user_id),
    );

  for (const miembro of miembros) {
    const p = perfiles?.find((x) => x.id === miembro.user_id);
    const nombre = p?.display_name ?? [p?.first_name, p?.last_name].filter(Boolean).join(" ") ?? "";
    nombres.set(miembro.id, nombre || "Veterinario");
  }
  return nombres;
}

export interface FilaConsulta {
  consulta: Tables<"clinical_encounters">;
  mascota: Pick<Tables<"pets">, "id" | "name" | "species"> | null;
  veterinario: string | null;
}

export async function listarConsultas(opciones: {
  clinicId: string;
  timezone: string;
  /** Rango local [desde, hasta) en YYYY-MM-DD; sin rango lista el histórico. */
  desde?: string;
  hasta?: string;
  estado?: EncounterStatus;
  veterinarianMemberId?: string;
  page?: number;
}): Promise<{ filas: FilaConsulta[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, opciones.page ?? 1);
  const inicio = (page - 1) * TAMANO_PAGINA_CONSULTAS;

  let consulta = supabase
    .from("clinical_encounters")
    .select("*", { count: "exact" })
    .eq("clinic_id", opciones.clinicId)
    .order("started_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA_CONSULTAS - 1);
  if (opciones.desde) {
    consulta = consulta.gte(
      "started_at",
      localAUtc(`${opciones.desde}T00:00`, opciones.timezone).toISOString(),
    );
  }
  if (opciones.hasta) {
    consulta = consulta.lt(
      "started_at",
      localAUtc(`${opciones.hasta}T00:00`, opciones.timezone).toISOString(),
    );
  }
  if (opciones.estado) consulta = consulta.eq("status", opciones.estado);
  if (opciones.veterinarianMemberId) {
    consulta = consulta.eq(
      "responsible_veterinarian_clinic_member_id",
      opciones.veterinarianMemberId,
    );
  }

  const { data, count } = await consulta;
  const encuentros = data ?? [];
  if (encuentros.length === 0) return { filas: [], total: count ?? 0 };

  const [{ data: mascotas }, veterinarios] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, species")
      .in("id", [...new Set(encuentros.map((e) => e.pet_id))]),
    nombresDeMiembros(encuentros.map((e) => e.responsible_veterinarian_clinic_member_id)),
  ]);

  return {
    filas: encuentros.map((encuentro) => ({
      consulta: encuentro,
      mascota: mascotas?.find((m) => m.id === encuentro.pet_id) ?? null,
      veterinario: veterinarios.get(encuentro.responsible_veterinarian_clinic_member_id) ?? null,
    })),
    total: count ?? 0,
  };
}

export interface DetalleConsulta {
  consulta: Tables<"clinical_encounters">;
  mascota: Tables<"pets"> | null;
  propietario: Pick<Tables<"pet_owners">, "id" | "display_name"> | null;
  veterinario: string | null;
  /** Contenido clínico: RLS lo oculta a recepción (llega vacío, no es error). */
  nota: Tables<"clinical_notes"> | null;
  exploracion: Tables<"encounter_examinations"> | null;
  vitales: Tables<"clinical_vitals">[];
  diagnosticos: Tables<"diagnoses">[];
  tratamientos: Tables<"encounter_treatments">[];
  seguimientos: Tables<"encounter_follow_ups">[];
  archivos: Tables<"clinical_files">[];
  adendas: Tables<"encounter_addenda">[];
  historial: Tables<"encounter_status_history">[];
}

export async function obtenerConsulta(id: string): Promise<DetalleConsulta | null> {
  const supabase = await createClient();
  const { data: consulta } = await supabase
    .from("clinical_encounters")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!consulta) return null;

  const [
    { data: mascota },
    { data: relacionPropietario },
    veterinarios,
    { data: nota },
    { data: exploracion },
    { data: vitales },
    { data: diagnosticos },
    { data: tratamientos },
    { data: seguimientos },
    { data: archivos },
    { data: adendas },
    { data: historial },
  ] = await Promise.all([
    supabase.from("pets").select("*").eq("id", consulta.pet_id).maybeSingle(),
    supabase
      .from("pet_owner_relationships")
      .select("owner_id, is_primary, pet_owners(id, display_name)")
      .eq("pet_id", consulta.pet_id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle(),
    nombresDeMiembros([consulta.responsible_veterinarian_clinic_member_id]),
    supabase.from("clinical_notes").select("*").eq("encounter_id", id).maybeSingle(),
    supabase.from("encounter_examinations").select("*").eq("encounter_id", id).maybeSingle(),
    supabase
      .from("clinical_vitals")
      .select("*")
      .eq("encounter_id", id)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("diagnoses")
      .select("*")
      .eq("encounter_id", id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at"),
    supabase
      .from("encounter_treatments")
      .select("*")
      .eq("encounter_id", id)
      .is("deleted_at", null)
      .order("created_at"),
    supabase.from("encounter_follow_ups").select("*").eq("encounter_id", id).order("created_at"),
    supabase
      .from("clinical_files")
      .select("*")
      .eq("encounter_id", id)
      .is("deleted_at", null)
      .order("created_at"),
    supabase.from("encounter_addenda").select("*").eq("encounter_id", id).order("created_at"),
    supabase
      .from("encounter_status_history")
      .select("*")
      .eq("encounter_id", id)
      .order("created_at"),
  ]);

  const propietario =
    (relacionPropietario?.pet_owners as unknown as {
      id: string;
      display_name: string | null;
    } | null) ?? null;

  return {
    consulta,
    mascota: mascota ?? null,
    propietario: propietario
      ? { id: propietario.id, display_name: propietario.display_name }
      : null,
    veterinario: veterinarios.get(consulta.responsible_veterinarian_clinic_member_id) ?? null,
    nota: nota ?? null,
    exploracion: exploracion ?? null,
    vitales: vitales ?? [],
    diagnosticos: diagnosticos ?? [],
    tratamientos: tratamientos ?? [],
    seguimientos: seguimientos ?? [],
    archivos: archivos ?? [],
    adendas: adendas ?? [],
    historial: historial ?? [],
  };
}

export interface FilaExpediente {
  consulta: Tables<"clinical_encounters">;
  veterinario: string | null;
  diagnosticoPrincipal: string | null;
  numeroArchivos: number;
}

/** Línea de tiempo de consultas de UNA mascota EN la clínica activa. */
export async function expedienteDeMascota(opciones: {
  petId: string;
  clinicId: string;
  estado?: EncounterStatus;
  tipo?: EncounterType;
  page?: number;
}): Promise<{ filas: FilaExpediente[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, opciones.page ?? 1);
  const inicio = (page - 1) * TAMANO_PAGINA_CONSULTAS;

  let consulta = supabase
    .from("clinical_encounters")
    .select("*", { count: "exact" })
    .eq("pet_id", opciones.petId)
    .eq("clinic_id", opciones.clinicId)
    .order("started_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA_CONSULTAS - 1);
  if (opciones.estado) consulta = consulta.eq("status", opciones.estado);
  if (opciones.tipo) consulta = consulta.eq("encounter_type", opciones.tipo);

  const { data, count } = await consulta;
  const encuentros = data ?? [];
  if (encuentros.length === 0) return { filas: [], total: count ?? 0 };

  const encounterIds = encuentros.map((e) => e.id);
  const [{ data: diagnosticos }, { data: archivos }, veterinarios] = await Promise.all([
    supabase
      .from("diagnoses")
      .select("encounter_id, name, is_primary")
      .in("encounter_id", encounterIds)
      .is("deleted_at", null),
    supabase
      .from("clinical_files")
      .select("id, encounter_id")
      .in("encounter_id", encounterIds)
      .is("deleted_at", null),
    nombresDeMiembros(encuentros.map((e) => e.responsible_veterinarian_clinic_member_id)),
  ]);

  return {
    filas: encuentros.map((encuentro) => {
      const deLaConsulta = (diagnosticos ?? []).filter((d) => d.encounter_id === encuentro.id);
      const principal = deLaConsulta.find((d) => d.is_primary) ?? deLaConsulta[0];
      return {
        consulta: encuentro,
        veterinario: veterinarios.get(encuentro.responsible_veterinarian_clinic_member_id) ?? null,
        diagnosticoPrincipal: principal?.name ?? null,
        numeroArchivos: (archivos ?? []).filter((a) => a.encounter_id === encuentro.id).length,
      };
    }),
    total: count ?? 0,
  };
}

export interface MetricasConsultas {
  abiertas: number;
  finalizadasHoy: number;
  walkInsHoy: number;
}

export async function metricasConsultas(
  clinicId: string,
  timezone: string,
): Promise<MetricasConsultas> {
  const supabase = await createClient();
  const hoy = hoyEnZona(timezone);
  const inicioHoy = localAUtc(`${hoy}T00:00`, timezone).toISOString();
  const finHoy = localAUtc(`${sumarDias(hoy, 1)}T00:00`, timezone).toISOString();

  const consultaBase = () =>
    supabase
      .from("clinical_encounters")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);

  const [abiertasRes, finalizadasRes, walkInsRes] = await Promise.all([
    consultaBase().eq("status", "in_progress"),
    consultaBase()
      .eq("status", "finalized")
      .gte("finalized_at", inicioHoy)
      .lt("finalized_at", finHoy),
    consultaBase()
      .in("encounter_type", ["walk_in", "emergency"])
      .neq("status", "voided")
      .gte("started_at", inicioHoy)
      .lt("started_at", finHoy),
  ]);

  return {
    abiertas: abiertasRes.count ?? 0,
    finalizadasHoy: finalizadasRes.count ?? 0,
    walkInsHoy: walkInsRes.count ?? 0,
  };
}
