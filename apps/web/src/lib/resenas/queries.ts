import "server-only";

import type { Enums } from "@dogtoralia/types";

import { createClient } from "@/lib/supabase/server";

type ReviewStatus = Enums<"review_status">;

/**
 * Consultas de moderación de reseñas del panel. SIEMPRE con el cliente del
 * usuario: RLS restringe las filas a la clínica del personal (política
 * reviews_select_clinica). Nunca service_role en apps/web.
 */

export interface ResenaPanel {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  created_at: string;
  author: string;
  veterinarian: string | null;
  clinicReply: string | null;
  clinicReplyAt: string | null;
  reportedAt: string | null;
  reportReason: string | null;
}

export interface MetricasResenas {
  average: number | null;
  count: number;
  ultimos30: number;
}

interface FilaResena {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  created_at: string;
  clinic_reply: string | null;
  clinic_reply_at: string | null;
  reported_at: string | null;
  report_reason: string | null;
  veterinarian_clinic_member_id: string;
  pet_owners: { first_name: string | null; last_name: string | null } | null;
}

/** Reseñas de la clínica activa (incluye ocultas y reportadas) para moderar. */
export async function listarResenasDeClinica(clinicId: string): Promise<ResenaPanel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select(
      "id, rating, title, body, status, created_at, clinic_reply, clinic_reply_at, reported_at, report_reason, veterinarian_clinic_member_id, pet_owners(first_name, last_name)",
    )
    .eq("clinic_id", clinicId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const filas = (data ?? []) as unknown as FilaResena[];
  if (filas.length === 0) return [];

  // Nombre visible del veterinario reseñado (snapshot por miembro de clínica).
  const nombresVet = await nombresDeVeterinarios(
    clinicId,
    filas.map((f) => f.veterinarian_clinic_member_id),
  );

  return filas.map((f) => ({
    id: f.id,
    rating: f.rating,
    title: f.title,
    body: f.body,
    status: f.status,
    created_at: f.created_at,
    author:
      [f.pet_owners?.first_name, f.pet_owners?.last_name].filter(Boolean).join(" ") ||
      "Propietario",
    veterinarian: nombresVet.get(f.veterinarian_clinic_member_id) ?? null,
    clinicReply: f.clinic_reply,
    clinicReplyAt: f.clinic_reply_at,
    reportedAt: f.reported_at,
    reportReason: f.report_reason,
  }));
}

async function nombresDeVeterinarios(
  clinicId: string,
  memberIds: string[],
): Promise<Map<string, string>> {
  const nombres = new Map<string, string>();
  const unicos = [...new Set(memberIds)];
  if (unicos.length === 0) return nombres;

  const supabase = await createClient();
  const { data: miembros } = await supabase
    .from("clinic_members")
    .select("id, user_id")
    .eq("clinic_id", clinicId)
    .in("id", unicos);
  if (!miembros || miembros.length === 0) return nombres;

  const { data: perfiles } = await supabase
    .from("colleague_profiles")
    .select("id, display_name, first_name, last_name")
    .in(
      "id",
      miembros.map((m) => m.user_id),
    );

  for (const m of miembros) {
    const p = perfiles?.find((x) => x.id === m.user_id);
    const nombre = p?.display_name ?? [p?.first_name, p?.last_name].filter(Boolean).join(" ") ?? "";
    if (nombre) nombres.set(m.id, nombre);
  }
  return nombres;
}

/** Métricas de reseñas de la clínica para el tablero (promedio y últimas 30 días). */
export async function metricasResenas(clinicId: string): Promise<MetricasResenas> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("rating, created_at")
    .eq("clinic_id", clinicId)
    .eq("status", "published")
    .is("deleted_at", null);
  const filas = (data ?? []) as { rating: number; created_at: string }[];

  const count = filas.length;
  const average =
    count === 0 ? null : Math.round((filas.reduce((s, r) => s + r.rating, 0) / count) * 100) / 100;
  const hace30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const ultimos30 = filas.filter((r) => new Date(r.created_at).getTime() >= hace30).length;

  return { average, count, ultimos30 };
}
