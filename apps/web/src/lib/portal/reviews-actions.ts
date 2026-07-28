"use server";

import { submitReviewSchema, updateMyReviewSchema } from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions del propietario para opiniones (Fase 8.1). DELGADAS: validan
 * con Zod en la frontera y delegan TODO invariante a las RPCs SECURITY DEFINER
 * (submit_review / update_my_review): verificación estructural, duplicados,
 * calificación y ventana de edición de 30 días. Nunca service_role.
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

/** Códigos estables de las RPCs de reseñas → español claro (sin detalles internos). */
function mapearErrorResena(mensaje: string): string {
  const e = mensajes.resenas.errores;
  if (mensaje.includes("CITA_NO_COMPLETADA")) return e.citaNoCompletada;
  if (mensaje.includes("RESENA_DUPLICADA")) return e.duplicada;
  if (mensaje.includes("CALIFICACION_INVALIDA")) return e.calificacionInvalida;
  if (mensaje.includes("RESENA_VACIA")) return e.vacia;
  if (mensaje.includes("PLAZO_EXCEDIDO")) return e.plazoExcedido;
  if (mensaje.includes("RESENA_NO_ENCONTRADA")) return e.noEncontrada;
  if (mensaje.includes("CITA_NO_ENCONTRADA")) return e.noEncontrada;
  if (mensaje.includes("AUTENTICACION_REQUERIDA"))
    return mensajes.mi.errores.autenticacionRequerida;
  return mensajes.comun.errorInesperado;
}

export async function enviarResena(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = submitReviewSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    rating: texto(formData, "rating"),
    title: texto(formData, "title"),
    body: texto(formData, "body"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_appointment_id: parsed.data.appointmentId,
    p_rating: parsed.data.rating,
    p_body: parsed.data.body,
    p_title: parsed.data.title,
  });
  if (error) return { ok: false, message: mapearErrorResena(error.message) };

  revalidatePath("/mi/opiniones");
  return { ok: true, message: mensajes.resenas.mi.enviada };
}

export async function editarMiResena(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = updateMyReviewSchema.safeParse({
    reviewId: formData.get("reviewId"),
    rating: texto(formData, "rating"),
    title: texto(formData, "title"),
    body: texto(formData, "body"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_review", {
    p_review_id: parsed.data.reviewId,
    p_rating: parsed.data.rating,
    p_body: parsed.data.body,
    p_title: parsed.data.title,
  });
  if (error) return { ok: false, message: mapearErrorResena(error.message) };

  revalidatePath("/mi/opiniones");
  return { ok: true, message: mensajes.resenas.mi.actualizada };
}
