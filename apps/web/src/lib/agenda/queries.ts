import "server-only";

import type { AppointmentStatus, Tables } from "@dogtoralia/types";

import { createClient } from "@/lib/supabase/server";

import { localAUtc, sumarDias } from "./dates";

/**
 * Consultas de agenda. Igual que en pacientes: SIEMPRE con el cliente del
 * usuario (RLS decide qué filas existen); nunca service_role en apps/web.
 */

export interface VeterinarioDeClinica {
  clinicMemberId: string;
  nombre: string;
}

/** Veterinarios activos de la clínica con su nombre visible (vista de colegas). */
export async function listarVeterinarios(clinicId: string): Promise<VeterinarioDeClinica[]> {
  const supabase = await createClient();
  const { data: miembros } = await supabase
    .from("clinic_members")
    .select("id, user_id")
    .eq("clinic_id", clinicId)
    .eq("role", "veterinarian")
    .eq("status", "active")
    .is("deleted_at", null);
  if (!miembros || miembros.length === 0) return [];

  const { data: perfiles } = await supabase
    .from("colleague_profiles")
    .select("id, display_name, first_name, last_name")
    .in(
      "id",
      miembros.map((m) => m.user_id),
    );

  return miembros
    .map((m) => {
      const p = perfiles?.find((x) => x.id === m.user_id);
      const nombre =
        p?.display_name ?? [p?.first_name, p?.last_name].filter(Boolean).join(" ") ?? "";
      return { clinicMemberId: m.id, nombre: nombre || "Veterinario" };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function listarServicios(
  clinicId: string,
  opciones: { soloActivos?: boolean } = {},
): Promise<Tables<"clinic_services">[]> {
  const supabase = await createClient();
  let consulta = supabase
    .from("clinic_services")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("name");
  if (opciones.soloActivos) consulta = consulta.eq("active", true);
  const { data } = await consulta;
  return data ?? [];
}

export async function obtenerServicio(id: string): Promise<{
  servicio: Tables<"clinic_services"> | null;
  veterinarios: Tables<"clinic_service_veterinarians">[];
}> {
  const supabase = await createClient();
  const { data: servicio } = await supabase
    .from("clinic_services")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!servicio) return { servicio: null, veterinarios: [] };
  const { data: veterinarios } = await supabase
    .from("clinic_service_veterinarians")
    .select("*")
    .eq("clinic_service_id", id);
  return { servicio, veterinarios: veterinarios ?? [] };
}

export async function listarHorario(
  clinicId: string,
  clinicMemberId: string,
): Promise<Tables<"veterinarian_schedules">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("veterinarian_schedules")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("clinic_member_id", clinicMemberId)
    .eq("active", true)
    .order("weekday")
    .order("start_time");
  return data ?? [];
}

export async function listarExcepciones(
  clinicId: string,
): Promise<Tables<"schedule_exceptions">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_exceptions")
    .select("*")
    .eq("clinic_id", clinicId)
    .gte("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(100);
  return data ?? [];
}

export interface SlotDisponible {
  slot_start: string;
  slot_end: string;
}

export async function obtenerDisponibilidad(opciones: {
  clinicId: string;
  veterinarianMemberId: string;
  serviceId: string;
  fromDate: string;
  toDate: string;
}): Promise<SlotDisponible[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_clinic_id: opciones.clinicId,
    p_veterinarian_clinic_member_id: opciones.veterinarianMemberId,
    p_clinic_service_id: opciones.serviceId,
    p_from_date: opciones.fromDate,
    p_to_date: opciones.toDate,
  });
  if (error) return [];
  return (data ?? []) as SlotDisponible[];
}

export interface FilaCita {
  cita: Tables<"appointments">;
  mascota: Pick<Tables<"pets">, "id" | "name" | "species"> | null;
  propietario: Pick<Tables<"pet_owners">, "id" | "display_name"> | null;
  servicios: string[];
}

async function decorarCitas(citas: Tables<"appointments">[]): Promise<FilaCita[]> {
  if (citas.length === 0) return [];
  const supabase = await createClient();
  const petIds = [...new Set(citas.map((c) => c.pet_id))];
  const ownerIds = [...new Set(citas.map((c) => c.owner_id))];
  const citaIds = citas.map((c) => c.id);

  const [{ data: mascotas }, { data: propietarios }, { data: servicios }] = await Promise.all([
    supabase.from("pets").select("id, name, species").in("id", petIds),
    supabase.from("pet_owners").select("id, display_name").in("id", ownerIds),
    supabase
      .from("appointment_services")
      .select("appointment_id, service_name")
      .in("appointment_id", citaIds),
  ]);

  return citas.map((cita) => ({
    cita,
    mascota: mascotas?.find((m) => m.id === cita.pet_id) ?? null,
    propietario: propietarios?.find((p) => p.id === cita.owner_id) ?? null,
    servicios: (servicios ?? [])
      .filter((s) => s.appointment_id === cita.id)
      .map((s) => s.service_name),
  }));
}

/** Citas de un rango [desde, hasta) en hora local de la clínica. */
export async function listarCitas(opciones: {
  clinicId: string;
  timezone: string;
  desde: string; // YYYY-MM-DD local
  hasta: string; // YYYY-MM-DD local (exclusivo)
  veterinarianMemberId?: string;
  estado?: AppointmentStatus;
}): Promise<FilaCita[]> {
  const supabase = await createClient();
  const inicio = localAUtc(`${opciones.desde}T00:00`, opciones.timezone).toISOString();
  const fin = localAUtc(`${opciones.hasta}T00:00`, opciones.timezone).toISOString();

  let consulta = supabase
    .from("appointments")
    .select("*")
    .eq("clinic_id", opciones.clinicId)
    .gte("scheduled_start", inicio)
    .lt("scheduled_start", fin)
    .order("scheduled_start")
    .limit(500);
  if (opciones.veterinarianMemberId) {
    consulta = consulta.eq("veterinarian_clinic_member_id", opciones.veterinarianMemberId);
  }
  if (opciones.estado) consulta = consulta.eq("status", opciones.estado);

  const { data } = await consulta;
  return decorarCitas(data ?? []);
}

export interface DetalleCita {
  cita: Tables<"appointments">;
  mascota: Tables<"pets"> | null;
  propietario: Tables<"pet_owners"> | null;
  servicios: Tables<"appointment_services">[];
  historial: Tables<"appointment_status_history">[];
  notificaciones: Tables<"appointment_notifications">[];
}

export async function obtenerCita(id: string): Promise<DetalleCita | null> {
  const supabase = await createClient();
  const { data: cita } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle();
  if (!cita) return null;

  const [
    { data: mascota },
    { data: propietario },
    { data: servicios },
    { data: historial },
    { data: notificaciones },
  ] = await Promise.all([
    supabase.from("pets").select("*").eq("id", cita.pet_id).maybeSingle(),
    supabase.from("pet_owners").select("*").eq("id", cita.owner_id).maybeSingle(),
    supabase.from("appointment_services").select("*").eq("appointment_id", id),
    supabase
      .from("appointment_status_history")
      .select("*")
      .eq("appointment_id", id)
      .order("created_at"),
    supabase
      .from("appointment_notifications")
      .select("*")
      .eq("appointment_id", id)
      .order("scheduled_for"),
  ]);

  return {
    cita,
    mascota: mascota ?? null,
    propietario: propietario ?? null,
    servicios: servicios ?? [],
    historial: historial ?? [],
    notificaciones: notificaciones ?? [],
  };
}

/** Pacientes elegibles para agendar: mascotas activas de la clínica + su propietario principal. */
export async function listarPacientesParaAgenda(
  clinicId: string,
): Promise<{ petId: string; ownerId: string; etiqueta: string }[]> {
  const supabase = await createClient();
  const { data: relaciones } = await supabase
    .from("clinic_pet_relationships")
    .select("pet_id")
    .eq("clinic_id", clinicId)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(500);
  const petIds = (relaciones ?? []).map((r) => r.pet_id);
  if (petIds.length === 0) return [];

  const [{ data: mascotas }, { data: duenos }] = await Promise.all([
    supabase.from("pets").select("id, name").in("id", petIds).order("name"),
    supabase
      .from("pet_owner_relationships")
      .select("pet_id, owner_id, is_primary, pet_owners(id, display_name)")
      .in("pet_id", petIds)
      .eq("status", "active")
      .is("deleted_at", null),
  ]);

  return (mascotas ?? []).flatMap((m) => {
    const rel =
      (duenos ?? []).find((d) => d.pet_id === m.id && d.is_primary) ??
      (duenos ?? []).find((d) => d.pet_id === m.id);
    if (!rel) return [];
    const dueno = rel.pet_owners as unknown as { id: string; display_name: string | null } | null;
    return [
      {
        petId: m.id,
        ownerId: rel.owner_id,
        etiqueta: `${m.name} — ${dueno?.display_name ?? "propietario"}`,
      },
    ];
  });
}

export interface MetricasAgenda {
  citasHoy: number;
  proximasSiete: number;
  completadasMes: number;
  canceladasMes: number;
}

export async function metricasAgenda(clinicId: string, timezone: string): Promise<MetricasAgenda> {
  const supabase = await createClient();
  const hoy = new Date();
  const hoyLocal = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(hoy);
  const inicioHoy = localAUtc(`${hoyLocal}T00:00`, timezone).toISOString();
  const finHoy = localAUtc(`${sumarDias(hoyLocal, 1)}T00:00`, timezone).toISOString();
  const finSemana = localAUtc(`${sumarDias(hoyLocal, 8)}T00:00`, timezone).toISOString();
  const inicioMes = localAUtc(`${hoyLocal.slice(0, 8)}01T00:00`, timezone).toISOString();

  const consultaBase = () =>
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);

  const [hoyRes, semanaRes, completadasRes, canceladasRes] = await Promise.all([
    consultaBase()
      .gte("scheduled_start", inicioHoy)
      .lt("scheduled_start", finHoy)
      .in("status", ["pending_confirmation", "confirmed", "checked_in", "in_progress"]),
    consultaBase()
      .gte("scheduled_start", finHoy)
      .lt("scheduled_start", finSemana)
      .in("status", ["pending_confirmation", "confirmed"]),
    consultaBase().eq("status", "completed").gte("scheduled_start", inicioMes),
    consultaBase().eq("status", "cancelled").gte("scheduled_start", inicioMes),
  ]);

  return {
    citasHoy: hoyRes.count ?? 0,
    proximasSiete: semanaRes.count ?? 0,
    completadasMes: completadasRes.count ?? 0,
    canceladasMes: canceladasRes.count ?? 0,
  };
}
