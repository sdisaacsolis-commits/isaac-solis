"use server";

import {
  acceptPortalInvitationSchema,
  cancelMyAppointmentSchema,
  portalInvitationSchema,
  publicBookingSchema,
  vetPublicProfileSchema,
} from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/env";
import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions del portal público y del portal del propietario. DELGADAS:
 * validan con Zod en la frontera y delegan TODO invariante a las RPCs
 * SECURITY DEFINER de la Fase 8 (anti-abuso, idempotencia, plazos, vínculos).
 * Jamás service_role; el cliente anon/ssr firma cada operación.
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

/** Códigos estables de las RPCs públicas → español claro (sin detalles internos). */
function mapearErrorReserva(mensaje: string): string {
  const e = mensajes.portalPublico.errores;
  if (mensaje.includes("RESERVACION_NO_DISPONIBLE")) return e.reservacionNoDisponible;
  if (mensaje.includes("HORARIO_NO_DISPONIBLE")) return e.horarioNoDisponible;
  if (mensaje.includes("SOLICITUDES_EXCEDIDAS")) return e.solicitudesExcedidas;
  if (mensaje.includes("DATOS_REQUERIDOS")) return e.datosRequeridos;
  if (mensaje.includes("CORREO_INVALIDO")) return e.correoInvalido;
  if (mensaje.includes("TELEFONO_INVALIDO")) return e.telefonoInvalido;
  if (mensaje.includes("FECHA_PASADA")) return e.fechaPasada;
  if (mensaje.includes("SERVICIO_INVALIDO")) return e.servicioInvalido;
  if (mensaje.includes("VETERINARIO_INVALIDO")) return e.veterinarioInvalido;
  return mensajes.comun.errorInesperado;
}

function mapearErrorPortal(mensaje: string): string {
  const e = mensajes.mi.errores;
  if (mensaje.includes("INVITACION_INVALIDA")) return e.invitacionInvalida;
  if (mensaje.includes("YA_VINCULADO")) return e.yaVinculado;
  if (mensaje.includes("AUTENTICACION_REQUERIDA")) return e.autenticacionRequerida;
  if (mensaje.includes("PLAZO_EXCEDIDO")) return e.plazoExcedido;
  if (mensaje.includes("ESTADO_INVALIDO")) return e.estadoInvalido;
  if (mensaje.includes("CITA_NO_ENCONTRADA")) return e.citaNoEncontrada;
  if (mensaje.includes("PERMISO_DENEGADO")) return e.permisoDenegado;
  return mensajes.comun.errorInesperado;
}

// ---------------------------------------------------------------------------
// Reservación pública de invitado (sin cuenta)
// ---------------------------------------------------------------------------

export type ReservaPublicaState = FormState & {
  /** Folio de la solicitud creada; presente solo en éxito. */
  folio?: string;
};

export async function solicitarReservaPublica(
  _prev: ReservaPublicaState,
  formData: FormData,
): Promise<ReservaPublicaState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = publicBookingSchema.safeParse({
    clinicSlug: formData.get("clinicSlug"),
    serviceId: formData.get("serviceId"),
    veterinarianMemberId: formData.get("veterinarianMemberId"),
    start: texto(formData, "start"),
    firstName: texto(formData, "firstName"),
    lastName: texto(formData, "lastName"),
    email: texto(formData, "email"),
    phone: texto(formData, "phone") ?? "",
    petName: texto(formData, "petName"),
    petSpecies: texto(formData, "petSpecies"),
    reason: texto(formData, "reason"),
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) {
    const errores = parsed.error.flatten();
    return {
      ok: false,
      message: errores.fieldErrors.start ? mensajes.portalPublico.reserva.eligeHorario : undefined,
      fieldErrors: errores.fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_public_appointment", {
    p_clinic_slug: parsed.data.clinicSlug,
    p_service_id: parsed.data.serviceId,
    p_veterinarian_clinic_member_id: parsed.data.veterinarianMemberId,
    p_start: parsed.data.start,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone ?? "",
    p_pet_name: parsed.data.petName,
    p_pet_species: parsed.data.petSpecies,
    p_reason: parsed.data.reason,
    p_request_id: parsed.data.requestId,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error ? mapearErrorReserva(error.message) : mensajes.comun.errorInesperado,
    };
  }

  const resultado = data as { folio?: string };
  return {
    ok: true,
    message: mensajes.portalPublico.reserva.avisoPendiente,
    folio: typeof resultado.folio === "string" ? resultado.folio : undefined,
  };
}

// ---------------------------------------------------------------------------
// Portal del propietario (requiere sesión)
// ---------------------------------------------------------------------------

export async function aceptarInvitacionPortal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = acceptPortalInvitationSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) {
    return { ok: false, message: mensajes.mi.invitacion.formatoInvalido };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/iniciar-sesion?next=${encodeURIComponent(`/portal/invitacion/${parsed.data.token}`)}`,
    );
  }

  const { error } = await supabase.rpc("accept_portal_invitation", {
    p_token: parsed.data.token,
  });
  if (error) return { ok: false, message: mapearErrorPortal(error.message) };

  redirect("/mi/mascotas?vinculado=1");
}

export async function cancelarMiCita(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = cancelMyAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: texto(formData, "reason"),
  });
  if (!parsed.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: mapearErrorPortal(error.message) };

  revalidatePath("/mi/citas");
  return { ok: true, message: mensajes.mi.citas.cancelada };
}

// ---------------------------------------------------------------------------
// Panel: invitación de propietarios al portal (personal operativo)
// ---------------------------------------------------------------------------

export type InvitacionPortalState = FormState & {
  /** Enlace de invitación; se muestra UNA sola vez (solo el hash persiste). */
  inviteUrl?: string;
};

export async function invitarPropietarioAlPortal(
  _prev: InvitacionPortalState,
  formData: FormData,
): Promise<InvitacionPortalState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = portalInvitationSchema.safeParse({
    clinicId: formData.get("clinicId"),
    ownerId: formData.get("ownerId"),
  });
  if (!parsed.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_portal_invitation", {
    p_clinic_id: parsed.data.clinicId,
    p_owner_id: parsed.data.ownerId,
  });
  if (error || !token) {
    const e = mensajes.pacientes.propietarios.portal.errores;
    const msg = error?.message ?? "";
    if (msg.includes("CORREO_REQUERIDO")) return { ok: false, message: e.correoRequerido };
    if (msg.includes("YA_VINCULADO")) return { ok: false, message: e.yaVinculado };
    if (msg.includes("PROPIETARIO_SIN_RELACION")) return { ok: false, message: e.sinRelacion };
    if (msg.includes("PROPIETARIO_NO_ENCONTRADO")) return { ok: false, message: e.noEncontrado };
    if (msg.includes("PERMISO_DENEGADO")) return { ok: false, message: e.sinPermiso };
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  revalidatePath(`/app/propietarios/${parsed.data.ownerId}`);
  return {
    ok: true,
    message: mensajes.pacientes.propietarios.portal.avisoUnaVez,
    inviteUrl: `${env.NEXT_PUBLIC_APP_URL}/portal/invitacion/${token}`,
  };
}

// ---------------------------------------------------------------------------
// Panel: perfil público del veterinario y visibilidad de la clínica
// ---------------------------------------------------------------------------

export async function guardarPerfilPublicoVeterinario(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = vetPublicProfileSchema.safeParse({
    slug: texto(formData, "slug"),
    headline: texto(formData, "headline"),
    bio: texto(formData, "bio"),
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion");

  const t = mensajes.configuracion.perfilPublico;
  // RLS restringe insert/update al propio user_id; aquí solo decidimos si
  // el registro ya existe para actualizarlo en lugar de duplicarlo.
  const { data: existente } = await supabase
    .from("veterinarian_public_profiles")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const valores = {
    slug: parsed.data.slug,
    headline: parsed.data.headline ?? null,
    bio: parsed.data.bio ?? null,
    is_public: parsed.data.isPublic,
  };
  const { error } = existente
    ? await supabase.from("veterinarian_public_profiles").update(valores).eq("id", existente.id)
    : await supabase.from("veterinarian_public_profiles").insert({ ...valores, user_id: user.id });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { slug: [t.slugOcupado] } };
    }
    if (error.code === "42501") {
      return { ok: false, message: mensajes.agenda.errores.sinPermiso };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  revalidatePath("/app/configuracion");
  return { ok: true, message: t.guardado };
}

export async function actualizarVisibilidadClinica(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const clinicId = z.string().uuid().safeParse(formData.get("clinicId"));
  if (!clinicId.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const t = mensajes.configuracion.clinicaPublica;
  const supabase = await createClient();
  // El grant de UPDATE sobre clinics incluye is_public y accepts_online_booking
  // (migración 20260719100004); RLS decide si este usuario administra la clínica.
  const { data, error } = await supabase
    .from("clinics")
    .update({
      is_public: formData.get("isPublic") === "on",
      accepts_online_booking: formData.get("acceptsOnlineBooking") === "on",
    })
    .eq("id", clinicId.data)
    .select("id, slug, is_public");
  if (error) {
    return {
      ok: false,
      message: error.code === "42501" ? t.soloAdmins : mensajes.comun.errorInesperado,
    };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: t.soloAdmins };
  }

  revalidatePath("/app/configuracion");
  const clinica = data[0];
  return {
    ok: true,
    message: t.guardado,
    warning: clinica && clinica.is_public && !clinica.slug ? t.requiereSlug : undefined,
  };
}
