import "server-only";

import type { Tables, VaccinationRecordStatus, VaccinationSource } from "@dogtoralia/types";
import { HISTORICAL_VACCINATION_SOURCES } from "@dogtoralia/types";

import { hoyEnZona, localAUtc, sumarDias } from "@/lib/agenda/dates";
import { nombresDeMiembros } from "@/lib/clinica/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Consultas de vacunación. SIEMPRE con el cliente del usuario: RLS decide qué
 * registros existen (la cartilla es operativa para el personal de la clínica;
 * jamás se mezclan organizaciones). Nunca service_role en apps/web.
 */

export const TAMANO_PAGINA_VACUNACION = 20;

export interface FiltrosCartilla {
  anio?: number;
  estado?: VaccinationRecordStatus;
  fuente?: VaccinationSource;
  vacuna?: string;
  proximas?: boolean;
  page?: number;
}

export interface FilaVacunacion {
  registro: Tables<"vaccination_records">;
  mascota: Pick<Tables<"pets">, "id" | "name" | "species"> | null;
  veterinario: string | null;
  clinica: string | null;
}

async function decorarRegistros(
  registros: Tables<"vaccination_records">[],
): Promise<FilaVacunacion[]> {
  if (registros.length === 0) return [];
  const supabase = await createClient();

  const [{ data: mascotas }, { data: clinicas }, veterinarios] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, species")
      .in("id", [...new Set(registros.map((r) => r.pet_id))]),
    supabase
      .from("clinics")
      .select("id, name")
      .in("id", [...new Set(registros.map((r) => r.clinic_id))]),
    nombresDeMiembros(
      registros
        .map((r) => r.administered_by_clinic_member_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]);

  return registros.map((registro) => ({
    registro,
    mascota: mascotas?.find((m) => m.id === registro.pet_id) ?? null,
    veterinario: registro.administered_by_clinic_member_id
      ? (veterinarios.get(registro.administered_by_clinic_member_id) ?? null)
      : null,
    clinica: clinicas?.find((c) => c.id === registro.clinic_id)?.name ?? null,
  }));
}

/** Cartilla de UNA mascota: eventos accesibles según RLS, con filtros. */
export async function cartillaDeMascota(opciones: {
  petId: string;
  timezone: string;
  filtros?: FiltrosCartilla;
}): Promise<{ filas: FilaVacunacion[]; total: number }> {
  const supabase = await createClient();
  const filtros = opciones.filtros ?? {};
  const page = Math.max(1, filtros.page ?? 1);
  const inicio = (page - 1) * TAMANO_PAGINA_VACUNACION;

  let consulta = supabase
    .from("vaccination_records")
    .select("*", { count: "exact" })
    .eq("pet_id", opciones.petId)
    .is("deleted_at", null)
    .order("administered_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA_VACUNACION - 1);
  if (filtros.estado) consulta = consulta.eq("status", filtros.estado);
  if (filtros.fuente) consulta = consulta.eq("source", filtros.fuente);
  if (filtros.vacuna) consulta = consulta.ilike("vaccine_name_snapshot", `%${filtros.vacuna}%`);
  if (filtros.anio) {
    consulta = consulta
      .gte(
        "administered_at",
        localAUtc(`${filtros.anio}-01-01T00:00`, opciones.timezone).toISOString(),
      )
      .lt(
        "administered_at",
        localAUtc(`${filtros.anio + 1}-01-01T00:00`, opciones.timezone).toISOString(),
      );
  }
  if (filtros.proximas) {
    consulta = consulta
      .not("next_due_at", "is", null)
      .gte("next_due_at", hoyEnZona(opciones.timezone));
  }

  const { data, count } = await consulta;
  return { filas: await decorarRegistros(data ?? []), total: count ?? 0 };
}

/** Registros de vacunación de la clínica activa (lista operativa). */
export async function listarVacunaciones(opciones: {
  clinicId: string;
  timezone: string;
  filtros?: FiltrosCartilla;
}): Promise<{ filas: FilaVacunacion[]; total: number }> {
  const supabase = await createClient();
  const filtros = opciones.filtros ?? {};
  const page = Math.max(1, filtros.page ?? 1);
  const inicio = (page - 1) * TAMANO_PAGINA_VACUNACION;

  let consulta = supabase
    .from("vaccination_records")
    .select("*", { count: "exact" })
    .eq("clinic_id", opciones.clinicId)
    .is("deleted_at", null)
    .order("administered_at", { ascending: false })
    .range(inicio, inicio + TAMANO_PAGINA_VACUNACION - 1);
  if (filtros.estado) consulta = consulta.eq("status", filtros.estado);
  if (filtros.fuente) consulta = consulta.eq("source", filtros.fuente);
  if (filtros.vacuna) consulta = consulta.ilike("vaccine_name_snapshot", `%${filtros.vacuna}%`);
  if (filtros.proximas) {
    consulta = consulta
      .not("next_due_at", "is", null)
      .gte("next_due_at", hoyEnZona(opciones.timezone));
  }

  const { data, count } = await consulta;
  return { filas: await decorarRegistros(data ?? []), total: count ?? 0 };
}

export interface DetalleVacunacion {
  registro: Tables<"vaccination_records">;
  documento: Tables<"vaccination_documents"> | null;
  historial: Tables<"vaccination_status_history">[];
  mascota: Tables<"pets"> | null;
  veterinario: string | null;
  clinica: Pick<Tables<"clinics">, "id" | "name" | "timezone"> | null;
}

export async function obtenerVacunacion(id: string): Promise<DetalleVacunacion | null> {
  const supabase = await createClient();
  const { data: registro } = await supabase
    .from("vaccination_records")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!registro) return null;

  const [
    { data: documento },
    { data: historial },
    { data: mascota },
    { data: clinica },
    veterinarios,
  ] = await Promise.all([
    supabase
      .from("vaccination_documents")
      .select("*")
      .eq("vaccination_record_id", id)
      .maybeSingle(),
    supabase
      .from("vaccination_status_history")
      .select("*")
      .eq("vaccination_record_id", id)
      .order("created_at"),
    supabase.from("pets").select("*").eq("id", registro.pet_id).maybeSingle(),
    supabase
      .from("clinics")
      .select("id, name, timezone")
      .eq("id", registro.clinic_id)
      .maybeSingle(),
    nombresDeMiembros(
      registro.administered_by_clinic_member_id ? [registro.administered_by_clinic_member_id] : [],
    ),
  ]);

  return {
    registro,
    documento: documento ?? null,
    historial: historial ?? [],
    mascota: mascota ?? null,
    veterinario: registro.administered_by_clinic_member_id
      ? (veterinarios.get(registro.administered_by_clinic_member_id) ?? null)
      : null,
    clinica: clinica ?? null,
  };
}

/** Catálogo de vacunas de la organización (activos primero). */
export async function catalogoVacunas(
  organizationId: string,
  opciones?: { soloActivos?: boolean },
): Promise<Tables<"vaccines_catalog">[]> {
  const supabase = await createClient();
  let consulta = supabase
    .from("vaccines_catalog")
    .select("*")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("name");
  if (opciones?.soloActivos) consulta = consulta.eq("active", true);
  const { data } = await consulta;
  return data ?? [];
}

/** Próximas dosis de la clínica en los siguientes 30 días. */
export async function proximasDosis(clinicId: string, timezone: string): Promise<FilaVacunacion[]> {
  const supabase = await createClient();
  const hoy = hoyEnZona(timezone);
  const { data } = await supabase
    .from("vaccination_records")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("status", "recorded")
    .is("deleted_at", null)
    .not("next_due_at", "is", null)
    .gte("next_due_at", hoy)
    .lte("next_due_at", sumarDias(hoy, 30))
    .order("next_due_at")
    .limit(20);
  return decorarRegistros(data ?? []);
}

export interface MetricasVacunacion {
  aplicadasHoy: number;
  proximas30: number;
  historicos: number;
  recordatoriosPendientes: number;
}

export async function metricasVacunacion(
  clinicId: string,
  timezone: string,
): Promise<MetricasVacunacion> {
  const supabase = await createClient();
  const hoy = hoyEnZona(timezone);
  const inicioHoy = localAUtc(`${hoy}T00:00`, timezone).toISOString();
  const finHoy = localAUtc(`${sumarDias(hoy, 1)}T00:00`, timezone).toISOString();

  const base = () =>
    supabase
      .from("vaccination_records")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .is("deleted_at", null);

  const [aplicadasRes, proximasRes, historicosRes, recordatoriosRes] = await Promise.all([
    base()
      .eq("source", "administered_in_clinic")
      .eq("status", "recorded")
      .gte("administered_at", inicioHoy)
      .lt("administered_at", finHoy),
    base()
      .eq("status", "recorded")
      .not("next_due_at", "is", null)
      .gte("next_due_at", hoy)
      .lte("next_due_at", sumarDias(hoy, 30)),
    base()
      .eq("status", "recorded")
      .in("source", [...HISTORICAL_VACCINATION_SOURCES]),
    supabase
      .from("vaccination_notifications")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "pending"),
  ]);

  return {
    aplicadasHoy: aplicadasRes.count ?? 0,
    proximas30: proximasRes.count ?? 0,
    historicos: historicosRes.count ?? 0,
    recordatoriosPendientes: recordatoriosRes.count ?? 0,
  };
}
