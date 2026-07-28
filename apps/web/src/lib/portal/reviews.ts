import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas de reseñas del portal del propietario: SOLO la RPC curada
 * get_my_reviewable_appointments (SECURITY DEFINER). Como el resto del portal,
 * sin Supabase degrada a vacío; PostgreSQL decide qué citas son del propietario.
 */

export interface MiResena {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: "published" | "hidden";
}

export interface CitaReseñable {
  appointment_id: string;
  folio: string;
  completed_at: string | null;
  clinic_name: string;
  clinic_slug: string | null;
  pet_name: string;
  veterinarian: string | null;
  review: MiResena | null;
}

export async function obtenerMisCitasReseñables(): Promise<CitaReseñable[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_reviewable_appointments");
  if (error || !data) return [];
  return data as unknown as CitaReseñable[];
}
