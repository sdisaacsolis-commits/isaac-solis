"use server";

import {
  createClinicSchema,
  createOrganizationSchema,
  inviteClinicMemberSchema,
  onboardingProfileSchema,
  profileSchema,
  updateClinicSchema,
  updateOrganizationSchema,
} from "@dogtoralia/validation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/env";
import { resolveSafeNext } from "@/lib/auth/redirects";
import { getEmailProvider } from "@/lib/email";
import { buildInvitationUrl, formatearVencimiento } from "@/lib/email/invitation-link";
import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { logOperational } from "@/lib/log";
import { etiquetasRolClinica } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_CLINICA_ACTIVA } from "@/lib/tenancy/queries";

function sinSupabase(): FormState {
  return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
}

function texto(formData: FormData, campo: string): string | undefined {
  const v = formData.get(campo);
  if (typeof v !== "string") return undefined;
  const limpio = v.trim();
  return limpio === "" ? undefined : limpio;
}

async function requireUserId(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id } : null;
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------
async function guardarPerfilConEsquema(
  formData: FormData,
  esquema: typeof profileSchema | typeof onboardingProfileSchema,
  destino?: string,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();
  const sesion = await requireUserId();
  if (!sesion) redirect("/iniciar-sesion");

  const parsed = esquema.safeParse({
    firstName: texto(formData, "firstName"),
    lastName: texto(formData, "lastName"),
    displayName: texto(formData, "displayName"),
    phone: texto(formData, "phone"),
    timezone: texto(formData, "timezone") ?? "America/Mexico_City",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName ?? null,
      last_name: parsed.data.lastName ?? null,
      display_name: parsed.data.displayName ?? null,
      phone: parsed.data.phone ?? null,
      timezone: parsed.data.timezone,
    })
    .eq("id", sesion.userId);

  if (error) return { ok: false, message: mensajes.comun.errorInesperado };

  if (destino) redirect(destino);
  revalidatePath("/app/configuracion");
  return { ok: true, message: mensajes.configuracion.perfilActualizado };
}

export async function guardarPerfilOnboarding(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return guardarPerfilConEsquema(formData, onboardingProfileSchema, "/app/onboarding");
}

export async function actualizarPerfil(_prev: FormState, formData: FormData): Promise<FormState> {
  return guardarPerfilConEsquema(formData, onboardingProfileSchema);
}

// ---------------------------------------------------------------------------
// Organización
// ---------------------------------------------------------------------------
export async function crearOrganizacion(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = createOrganizationSchema.safeParse({
    name: texto(formData, "name"),
    slug: texto(formData, "slug"),
    legalName: texto(formData, "legalName"),
    taxId: texto(formData, "taxId"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization_with_owner", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_legal_name: parsed.data.legalName,
    p_tax_id: parsed.data.taxId,
  });

  if (error) {
    if (error.message.includes("SLUG_RESERVADO")) {
      return { ok: false, fieldErrors: { slug: [mensajes.onboarding.organizacion.slugReservado] } };
    }
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { slug: [mensajes.onboarding.organizacion.slugOcupado] } };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  redirect("/app/onboarding");
}

export async function actualizarOrganizacion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const id = z.string().uuid().safeParse(formData.get("organizationId"));
  const parsed = updateOrganizationSchema.safeParse({
    name: texto(formData, "name"),
    slug: texto(formData, "slug"),
    legalName: texto(formData, "legalName"),
    taxId: texto(formData, "taxId"),
  });
  if (!id.success) return { ok: false, message: mensajes.comun.errorInesperado };
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug ?? null,
      legal_name: parsed.data.legalName ?? null,
      tax_id: parsed.data.taxId ?? null,
    })
    .eq("id", id.data)
    .select("id");

  if (error) {
    if (error.message.includes("SLUG_RESERVADO")) {
      return { ok: false, fieldErrors: { slug: [mensajes.onboarding.organizacion.slugReservado] } };
    }
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { slug: [mensajes.onboarding.organizacion.slugOcupado] } };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }
  if (!data || data.length === 0) {
    // RLS filtró la fila: sin permisos (solo el owner edita).
    return { ok: false, message: mensajes.organizacion.soloOwner };
  }

  revalidatePath("/app/organizacion");
  return { ok: true, message: mensajes.organizacion.actualizada };
}

// ---------------------------------------------------------------------------
// Clínicas
// ---------------------------------------------------------------------------
export async function crearClinica(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = createClinicSchema.safeParse({
    organizationId: formData.get("organizationId"),
    name: texto(formData, "name"),
    slug: texto(formData, "slug"),
    email: texto(formData, "email"),
    phone: texto(formData, "phone"),
    timezone: texto(formData, "timezone") ?? "America/Mexico_City",
    addressLine1: texto(formData, "addressLine1"),
    addressLine2: texto(formData, "addressLine2"),
    neighborhood: texto(formData, "neighborhood"),
    city: texto(formData, "city"),
    state: texto(formData, "state"),
    postalCode: texto(formData, "postalCode"),
    description: texto(formData, "description"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: clinicId, error } = await supabase.rpc("create_clinic_with_admin", {
    p_organization_id: parsed.data.organizationId,
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_timezone: parsed.data.timezone,
    p_description: parsed.data.description,
    p_address_line_1: parsed.data.addressLine1,
    p_address_line_2: parsed.data.addressLine2,
    p_neighborhood: parsed.data.neighborhood,
    p_city: parsed.data.city,
    p_state: parsed.data.state,
    p_postal_code: parsed.data.postalCode,
  });

  if (error) {
    if (error.message.includes("SLUG_RESERVADO")) {
      return { ok: false, fieldErrors: { slug: [mensajes.onboarding.organizacion.slugReservado] } };
    }
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { slug: [mensajes.onboarding.organizacion.slugOcupado] } };
    }
    if (error.code === "42501") {
      return { ok: false, message: mensajes.clinicas.soloAdmins };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_CLINICA_ACTIVA, clinicId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/app/inicio");
}

export async function actualizarClinica(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const id = z.string().uuid().safeParse(formData.get("clinicId"));
  const parsed = updateClinicSchema.safeParse({
    name: texto(formData, "name"),
    slug: texto(formData, "slug"),
    email: texto(formData, "email"),
    phone: texto(formData, "phone"),
    timezone: texto(formData, "timezone"),
    addressLine1: texto(formData, "addressLine1"),
    addressLine2: texto(formData, "addressLine2"),
    neighborhood: texto(formData, "neighborhood"),
    city: texto(formData, "city"),
    state: texto(formData, "state"),
    postalCode: texto(formData, "postalCode"),
    description: texto(formData, "description"),
  });
  if (!id.success) return { ok: false, message: mensajes.comun.errorInesperado };
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinics")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      timezone: parsed.data.timezone,
      address_line_1: parsed.data.addressLine1 ?? null,
      address_line_2: parsed.data.addressLine2 ?? null,
      neighborhood: parsed.data.neighborhood ?? null,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      postal_code: parsed.data.postalCode ?? null,
      description: parsed.data.description ?? null,
    })
    .eq("id", id.data)
    .select("id");

  if (error) {
    if (error.message.includes("SLUG_RESERVADO")) {
      return { ok: false, fieldErrors: { slug: [mensajes.onboarding.organizacion.slugReservado] } };
    }
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { slug: [mensajes.onboarding.organizacion.slugOcupado] } };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: mensajes.personal.sinAcceso };
  }

  revalidatePath("/app/clinicas");
  return { ok: true, message: mensajes.clinicas.actualizada };
}

export async function elegirClinicaActiva(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("clinicId"));
  if (!isSupabaseConfigured() || !id.success) redirect("/app/inicio");

  // La cookie solo se fija si RLS permite ver esa clínica.
  const supabase = await createClient();
  const { data } = await supabase.from("clinics").select("id").eq("id", id.data).maybeSingle();
  if (data) {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_CLINICA_ACTIVA, data.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }
  redirect(resolveSafeNext(texto(formData, "redirectTo"), "/app/inicio"));
}

// ---------------------------------------------------------------------------
// Invitaciones
// ---------------------------------------------------------------------------
async function enviarCorreoInvitacion(opciones: {
  correo: string;
  clinicaNombre: string;
  rolEtiqueta: string;
  token: string;
  inviteeName?: string;
  invitedByName?: string;
}): Promise<{ enviado: boolean; razon?: string }> {
  const provider = getEmailProvider();
  const acceptUrl = buildInvitationUrl(env.NEXT_PUBLIC_APP_URL, opciones.token);
  const vence = formatearVencimiento(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const resultado = await provider.sendInvitation({
    to: opciones.correo,
    clinicName: opciones.clinicaNombre,
    roleLabel: opciones.rolEtiqueta,
    acceptUrl,
    expiresAtText: vence,
    inviteeName: opciones.inviteeName,
    invitedByName: opciones.invitedByName,
  });

  logOperational(resultado.sent ? "invitacion.correo.enviado" : "invitacion.correo.fallo", {
    proveedor: provider.name,
    clinica: opciones.clinicaNombre,
    enviado: resultado.sent,
    razon: resultado.sent ? "" : resultado.reason,
  });

  return resultado.sent ? { enviado: true } : { enviado: false, razon: resultado.reason };
}

export async function invitarPersonal(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = inviteClinicMemberSchema.safeParse({
    clinicId: formData.get("clinicId"),
    email: texto(formData, "email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const inviteeName = texto(formData, "inviteeName");

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("invite_clinic_member", {
    p_clinic_id: parsed.data.clinicId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });

  if (error || !token) {
    if (error?.message.includes("INVITACION_DUPLICADA")) {
      return { ok: false, message: mensajes.personal.invitaciones.duplicada };
    }
    if (error?.code === "42501") {
      return { ok: false, message: mensajes.personal.invitaciones.soloAdmins };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  const { data: clinica } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", parsed.data.clinicId)
    .maybeSingle();
  const { data: perfil } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", (await requireUserId())?.userId ?? "")
    .maybeSingle();

  const resultado = await enviarCorreoInvitacion({
    correo: parsed.data.email,
    clinicaNombre: clinica?.name ?? "una clínica en Dogtoralia",
    rolEtiqueta: etiquetasRolClinica[parsed.data.role],
    token,
    inviteeName,
    invitedByName: perfil?.display_name ?? undefined,
  });

  revalidatePath("/app/personal");
  if (resultado.enviado) {
    return { ok: true, message: mensajes.personal.invitaciones.creadaYEnviada };
  }
  return {
    ok: true,
    warning: mensajes.personal.invitaciones.creadaSinCorreo(resultado.razon ?? ""),
  };
}

export async function reenviarInvitacion(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const id = z.string().uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return { ok: false, message: mensajes.comun.errorInesperado };

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("resend_clinic_invitation", {
    p_invitation_id: id.data,
  });
  if (error || !token) {
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  // Columnas permitidas (sin token_hash) para armar el correo.
  const { data: invitacion } = await supabase
    .from("clinic_invitations")
    .select("email, role, clinic_id")
    .eq("id", id.data)
    .maybeSingle();
  const { data: clinica } = invitacion
    ? await supabase.from("clinics").select("name").eq("id", invitacion.clinic_id).maybeSingle()
    : { data: null };

  const resultado = invitacion
    ? await enviarCorreoInvitacion({
        correo: invitacion.email,
        clinicaNombre: clinica?.name ?? "una clínica en Dogtoralia",
        rolEtiqueta: etiquetasRolClinica[invitacion.role],
        token,
      })
    : { enviado: false, razon: mensajes.comun.errorInesperado };

  revalidatePath("/app/personal");
  if (resultado.enviado) {
    return { ok: true, message: mensajes.personal.invitaciones.reenviada };
  }
  return {
    ok: true,
    warning: mensajes.personal.invitaciones.reenviadaSinCorreo(resultado.razon ?? ""),
  };
}

export async function revocarInvitacion(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("invitationId"));
  if (!isSupabaseConfigured() || !id.success) redirect("/app/personal");

  const supabase = await createClient();
  // RLS: solo admins pueden pasar pending → revoked; nadie más muta invitaciones.
  await supabase
    .from("clinic_invitations")
    .update({ status: "revoked" })
    .eq("id", id.data)
    .eq("status", "pending");

  revalidatePath("/app/personal");
  redirect("/app/personal");
}
