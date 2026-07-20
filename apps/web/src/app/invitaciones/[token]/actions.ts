"use server";

import { invitationTokenSchema } from "@dogtoralia/validation";
import { redirect } from "next/navigation";

import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const t = mensajes.invitacion;

/**
 * Acepta la invitación SOLO tras verificación explícita del usuario (clic),
 * nunca automáticamente al abrir el enlace. La RPC valida vigencia, estado y
 * que el correo autenticado coincida con el invitado.
 */
export async function aceptarInvitacion(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
  }

  const token = invitationTokenSchema.safeParse(formData.get("token"));
  if (!token.success) {
    return { ok: false, message: t.errores.formatoInvalido };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/iniciar-sesion?next=${encodeURIComponent(`/invitaciones/${token.data}`)}`);
  }

  const { error } = await supabase.rpc("accept_clinic_invitation", { p_token: token.data });

  if (error) {
    const msg = error.message;
    if (msg.includes("INVITACION_VENCIDA")) return { ok: false, message: t.errores.vencida };
    if (msg.includes("INVITACION_NO_ENCONTRADA")) {
      return { ok: false, message: t.errores.usadaORevocada };
    }
    if (msg.includes("CORREO_NO_COINCIDE")) return { ok: false, message: t.errores.correoDistinto };
    if (msg.includes("MEMBRESIA_NO_ACTIVA")) {
      return { ok: false, message: t.errores.membresiaInactiva };
    }
    if (msg.includes("YA_ES_MIEMBRO")) return { ok: false, message: t.errores.yaEsMiembro };
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  redirect("/app/inicio?bienvenida=1");
}
