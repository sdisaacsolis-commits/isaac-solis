import "server-only";

import type { Tables } from "@dogtoralia/types";

import { createClient } from "@/lib/supabase/server";

import { escaparBusqueda } from "./format";

/**
 * Consultas del dominio de pacientes. TODAS corren con el cliente del usuario
 * (llave anon + sesión): RLS es quien decide qué filas existen. Nunca se usa
 * service_role ni se confía en IDs del navegador sin que RLS los valide.
 * Paginación y selección de campos para evitar N+1 y respuestas gigantes.
 */

export const TAMANO_PAGINA = 20;

export interface FilaPropietario {
  relacion: Tables<"owner_clinic_relationships">;
  propietario: Tables<"pet_owners">;
  mascotasAccesibles: number;
}

export async function listarPropietarios(opciones: {
  clinicId: string;
  q?: string;
  page: number;
}): Promise<{ filas: FilaPropietario[]; total: number }> {
  const supabase = await createClient();
  const desde = (opciones.page - 1) * TAMANO_PAGINA;

  let consulta = supabase
    .from("owner_clinic_relationships")
    .select("*, pet_owners!inner(*)", { count: "exact" })
    .eq("clinic_id", opciones.clinicId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(desde, desde + TAMANO_PAGINA - 1);

  if (opciones.q) {
    const q = escaparBusqueda(opciones.q);
    consulta = consulta.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
      { referencedTable: "pet_owners" },
    );
  }

  const { data, count } = await consulta;
  const filas = (data ?? []).map((fila) => ({
    relacion: fila as unknown as Tables<"owner_clinic_relationships">,
    propietario: fila.pet_owners as unknown as Tables<"pet_owners">,
    mascotasAccesibles: 0,
  }));

  // Conteo de mascotas accesibles por propietario en una sola consulta (sin N+1).
  const ownerIds = filas.map((f) => f.propietario.id);
  if (ownerIds.length > 0) {
    const { data: relaciones } = await supabase
      .from("pet_owner_relationships")
      .select("owner_id")
      .in("owner_id", ownerIds)
      .eq("status", "active")
      .is("deleted_at", null);
    const conteo = new Map<string, number>();
    for (const r of relaciones ?? []) {
      conteo.set(r.owner_id, (conteo.get(r.owner_id) ?? 0) + 1);
    }
    for (const fila of filas) {
      fila.mascotasAccesibles = conteo.get(fila.propietario.id) ?? 0;
    }
  }

  return { filas, total: count ?? 0 };
}

export interface FilaMascota {
  relacion: Tables<"clinic_pet_relationships">;
  mascota: Tables<"pets">;
  principal: Tables<"pet_owners"> | null;
  alertasActivas: number;
}

export async function listarMascotas(opciones: {
  clinicId: string;
  q?: string;
  species?: Tables<"pets">["species"];
  sex?: Tables<"pets">["sex"];
  page: number;
}): Promise<{ filas: FilaMascota[]; total: number }> {
  const supabase = await createClient();
  const desde = (opciones.page - 1) * TAMANO_PAGINA;

  let consulta = supabase
    .from("clinic_pet_relationships")
    .select("*, pets!inner(*)", { count: "exact" })
    .eq("clinic_id", opciones.clinicId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(desde, desde + TAMANO_PAGINA - 1);

  if (opciones.q) {
    const q = escaparBusqueda(opciones.q);
    consulta = consulta.or(`name.ilike.%${q}%,breed.ilike.%${q}%,microchip_number.ilike.%${q}%`, {
      referencedTable: "pets",
    });
  }
  if (opciones.species) consulta = consulta.eq("pets.species", opciones.species);
  if (opciones.sex) consulta = consulta.eq("pets.sex", opciones.sex);

  const { data, count } = await consulta;
  let filas: FilaMascota[] = (data ?? []).map((fila) => ({
    relacion: fila as unknown as Tables<"clinic_pet_relationships">,
    mascota: fila.pets as unknown as Tables<"pets">,
    principal: null,
    alertasActivas: 0,
  }));
  let total = count ?? 0;

  // Búsqueda adicional por número interno de paciente (columna de la relación).
  if (opciones.q && filas.length < TAMANO_PAGINA) {
    const { data: porNumero } = await supabase
      .from("clinic_pet_relationships")
      .select("*, pets!inner(*)")
      .eq("clinic_id", opciones.clinicId)
      .eq("status", "active")
      .is("deleted_at", null)
      .ilike("internal_patient_number", `%${escaparBusqueda(opciones.q)}%`)
      .limit(TAMANO_PAGINA);
    for (const fila of porNumero ?? []) {
      if (!filas.some((f) => f.relacion.id === fila.id)) {
        filas.push({
          relacion: fila as unknown as Tables<"clinic_pet_relationships">,
          mascota: fila.pets as unknown as Tables<"pets">,
          principal: null,
          alertasActivas: 0,
        });
        total += 1;
      }
    }
    filas = filas.slice(0, TAMANO_PAGINA);
  }

  const petIds = filas.map((f) => f.mascota.id);
  if (petIds.length > 0) {
    const [{ data: principales }, { data: alertas }] = await Promise.all([
      supabase
        .from("pet_owner_relationships")
        .select("pet_id, pet_owners(*)")
        .in("pet_id", petIds)
        .eq("is_primary", true)
        .eq("status", "active")
        .is("deleted_at", null),
      supabase
        .from("pet_alerts")
        .select("pet_id")
        .in("pet_id", petIds)
        .eq("clinic_id", opciones.clinicId)
        .eq("active", true),
    ]);
    const mapaPrincipal = new Map(
      (principales ?? []).map((p) => [p.pet_id, p.pet_owners as unknown as Tables<"pet_owners">]),
    );
    const conteoAlertas = new Map<string, number>();
    for (const a of alertas ?? []) {
      conteoAlertas.set(a.pet_id, (conteoAlertas.get(a.pet_id) ?? 0) + 1);
    }
    for (const fila of filas) {
      fila.principal = mapaPrincipal.get(fila.mascota.id) ?? null;
      fila.alertasActivas = conteoAlertas.get(fila.mascota.id) ?? 0;
    }
  }

  return { filas, total };
}

/**
 * Detección de posibles duplicados dentro del alcance RLS del actor.
 * Solo devuelve registros que el actor ya puede ver: jamás expone datos de
 * otras clínicas (los registros externos simplemente no existen para RLS).
 */
export async function buscarPropietariosParecidos(datos: {
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
}): Promise<Tables<"pet_owners">[]> {
  const supabase = await createClient();
  const condiciones: string[] = [];
  if (datos.email) condiciones.push(`email.eq.${escaparBusqueda(datos.email)}`);
  if (datos.phone) condiciones.push(`phone.eq.${escaparBusqueda(datos.phone)}`);
  condiciones.push(
    `and(first_name.ilike.${escaparBusqueda(datos.firstName)},last_name.ilike.${escaparBusqueda(datos.lastName)})`,
  );

  const { data } = await supabase
    .from("pet_owners")
    .select("*")
    .or(condiciones.join(","))
    .is("deleted_at", null)
    .limit(5);
  return data ?? [];
}

export async function buscarMascotasParecidas(datos: {
  microchip?: string;
  name: string;
  species: Tables<"pets">["species"];
  ownerId?: string;
}): Promise<Tables<"pets">[]> {
  const supabase = await createClient();

  if (datos.microchip) {
    const { data } = await supabase
      .from("pets")
      .select("*")
      .eq("microchip_number", datos.microchip)
      .is("deleted_at", null)
      .limit(5);
    if (data && data.length > 0) return data;
  }

  const { data } = await supabase
    .from("pets")
    .select("*, pet_owner_relationships!inner(owner_id, status)")
    .ilike("name", escaparBusqueda(datos.name))
    .eq("species", datos.species)
    .eq("pet_owner_relationships.status", "active")
    .is("deleted_at", null)
    .limit(5);

  const filas = (data ?? []) as unknown as (Tables<"pets"> & {
    pet_owner_relationships: { owner_id: string }[];
  })[];
  return datos.ownerId
    ? filas.filter((p) => p.pet_owner_relationships.some((r) => r.owner_id === datos.ownerId))
    : filas;
}

/** Métricas del dashboard para la clínica activa (conteos head-only). */
export async function metricasPacientes(clinicId: string) {
  const supabase = await createClient();
  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);

  const [propietarios, mascotas, perros, gatos, delMes, alertas] = await Promise.all([
    supabase
      .from("owner_clinic_relationships")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("clinic_pet_relationships")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("clinic_pet_relationships")
      .select("id, pets!inner(species)", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .is("deleted_at", null)
      .eq("pets.species", "dog"),
    supabase
      .from("clinic_pet_relationships")
      .select("id, pets!inner(species)", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "active")
      .is("deleted_at", null)
      .eq("pets.species", "cat"),
    supabase
      .from("clinic_pet_relationships")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", inicioMes.toISOString()),
    supabase
      .from("pet_alerts")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("active", true),
  ]);

  return {
    propietarios: propietarios.count ?? 0,
    mascotas: mascotas.count ?? 0,
    perros: perros.count ?? 0,
    gatos: gatos.count ?? 0,
    delMes: delMes.count ?? 0,
    alertas: alertas.count ?? 0,
  };
}
