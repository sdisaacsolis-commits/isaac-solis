"use server";

import {
  moderateReviewSchema,
  replyToReviewSchema,
  reportReviewSchema,
} from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions de moderación de reseñas del panel (Fase 8.1). DELGADAS:
 * validan con Zod en la frontera y delegan TODO invariante y permiso a las RPCs
 * SECURITY DEFINER (reply_to_review / report_review / set_review_visibility).
 * La UI puede ocultar botones, pero la autoridad es PostgreSQL. Nunca
 * service_role en apps/web.
 */

function sinSupabase(): FormState {
  return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
}

function texto(formData: FormData, campo: string): string | undefined {
  const v = formData.get(campo);
  if (typeof v !== "string") return undefined;
  const limpio = v.trim();
  return limpio === "" ? undefined : limpio;
}

/** Códigos estables de las RPCs de moderación → español claro. */
function mapearErrorModeracion(mensaje: string): string {
  const e = mensajes.resenas.errores;
  if (mensaje.includes("PERMISO_DENEGADO")) return e.permisoDenegado;
  if (mensaje.includes("MOTIVO_REQUERIDO")) return e.motivoRequerido;
  if (mensaje.includes("RESPUESTA_VACIA")) return e.respuestaVacia;
  if (mensaje.includes("RESENA_NO_ENCONTRADA")) return e.noEncontrada;
  return mensajes.comun.errorInesperado;
}

export async function responderResena(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = replyToReviewSchema.safeParse({
    reviewId: formData.get("reviewId"),
    reply: texto(formData, "reply"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_to_review", {
    p_review_id: parsed.data.reviewId,
    p_reply: parsed.data.reply,
  });
  if (error) return { ok: false, message: mapearErrorModeracion(error.message) };

  revalidatePath("/app/opiniones");
  return { ok: true, message: mensajes.resenas.panel.respondida };
}

export async function reportarResena(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = reportReviewSchema.safeParse({
    reviewId: formData.get("reviewId"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("report_review", {
    p_review_id: parsed.data.reviewId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: mapearErrorModeracion(error.message) };

  revalidatePath("/app/opiniones");
  return { ok: true, message: mensajes.resenas.panel.reportada };
}

export async function moderarResena(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = moderateReviewSchema.safeParse({
    reviewId: formData.get("reviewId"),
    hidden: formData.get("hidden") === "true",
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_review_visibility", {
    p_review_id: parsed.data.reviewId,
    p_hidden: parsed.data.hidden,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: mapearErrorModeracion(error.message) };

  revalidatePath("/app/opiniones");
  return {
    ok: true,
    message: parsed.data.hidden
      ? mensajes.resenas.panel.ocultada
      : mensajes.resenas.panel.restaurada,
  };
}
