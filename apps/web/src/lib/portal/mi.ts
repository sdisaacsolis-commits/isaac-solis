import "server-only";

import type { AppointmentStatus, PetSex, PetSpecies } from "@dogtoralia/types";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas del portal del propietario: SOLO RPCs curadas (get_my_*). El
 * propietario nunca lee tablas base; PostgreSQL decide qué es suyo.
 */

export interface MascotaMia {
  pet_id: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  sex: PetSex;
  birth_date: string | null;
}

export interface CitaMia {
  appointment_id: string;
  folio: string;
  status: AppointmentStatus;
  scheduled_start: string;
  scheduled_end: string;
  reason: string | null;
  pet_name: string;
  clinic_name: string;
  clinic_timezone: string;
  veterinarian: string | null;
}

export interface ConsultaDeHistorial {
  folio: string;
  started_at: string;
  finalized_at: string | null;
  chief_complaint: string | null;
  clinic_name: string;
}

export interface PartidaDeRecetaHistorial {
  medication_name: string;
  dosage_text: string | null;
  frequency_text: string | null;
  duration_text: string | null;
}

export interface RecetaDeHistorial {
  folio: string | null;
  status: string;
  issued_at: string | null;
  clinic_name: string;
  items: PartidaDeRecetaHistorial[] | null;
}

export interface VacunaDeHistorial {
  vaccine_name: string;
  administered_at: string;
  next_due_at: string | null;
  source: string;
  status: string;
  clinic_name: string;
}

export interface HistorialDeMascota {
  encounters: ConsultaDeHistorial[];
  prescriptions: RecetaDeHistorial[];
  vaccinations: VacunaDeHistorial[];
}

export async function obtenerMisMascotas(): Promise<MascotaMia[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_pets");
  if (error || !data) return [];
  return data as unknown as MascotaMia[];
}

export async function obtenerMisCitas(): Promise<CitaMia[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_appointments");
  if (error || !data) return [];
  return data as unknown as CitaMia[];
}

/** Historial de UNA mascota vinculada; null si no pertenece a la cuenta. */
export async function obtenerHistorialDeMiMascota(
  petId: string,
): Promise<HistorialDeMascota | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_pet_history", { p_pet_id: petId });
  if (error || !data) return null;
  return data as unknown as HistorialDeMascota;
}
