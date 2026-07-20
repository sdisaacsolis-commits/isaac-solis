"use server";

import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
} from "@dogtoralia/validation";
import { redirect } from "next/navigation";

import { env } from "@/env";
import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { DESTINO_ONBOARDING, DESTINO_POR_DEFECTO, resolveSafeNext } from "./redirects";

function sinSupabase(): FormState {
  return { ok: false, message: mensajes.comun.supabaseNoConfigurado };
}

function valor(formData: FormData, campo: string): string | undefined {
  const v = formData.get(campo);
  return typeof v === "string" ? v : undefined;
}

export async function registrarse(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = registerSchema.safeParse({
    firstName: valor(formData, "firstName"),
    lastName: valor(formData, "lastName"),
    email: valor(formData, "email"),
    password: valor(formData, "password"),
    confirmPassword: valor(formData, "confirmPassword"),
    acceptTerms: formData.get("acceptTerms") === "on",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const next = resolveSafeNext(valor(formData, "next"), DESTINO_ONBOARDING);
  const supabase = await createClient();
  const displayName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: displayName,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/confirmar?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    // Anti-enumeración: un correo ya registrado recibe el MISMO mensaje que el
    // registro exitoso con confirmación pendiente.
    if (error.code === "user_already_exists" || error.status === 422) {
      return { ok: true, message: mensajes.auth.registro.revisaCorreo };
    }
    return { ok: false, message: mensajes.comun.errorInesperado };
  }

  if (data.session) {
    redirect(next); // confirmación de correo deshabilitada en este entorno
  }
  return { ok: true, message: mensajes.auth.registro.revisaCorreo };
}

export async function iniciarSesion(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = loginSchema.safeParse({
    email: valor(formData, "email"),
    password: valor(formData, "password"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, message: mensajes.auth.iniciarSesion.correoNoConfirmado };
    }
    // Genérico a propósito: no revela si la cuenta existe.
    return { ok: false, message: mensajes.auth.iniciarSesion.credencialesInvalidas };
  }

  redirect(resolveSafeNext(valor(formData, "next"), DESTINO_POR_DEFECTO));
}

export async function cerrarSesion(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function solicitarRecuperacion(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = requestPasswordResetSchema.safeParse({ email: valor(formData, "email") });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/actualizar-contrasena`,
  });

  // Siempre el mismo mensaje, exista o no la cuenta (anti-enumeración).
  return { ok: true, message: mensajes.auth.recuperar.enviado };
}

export async function actualizarContrasena(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isSupabaseConfigured()) return sinSupabase();

  const parsed = updatePasswordSchema.safeParse({
    password: valor(formData, "password"),
    confirmPassword: valor(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: mensajes.auth.actualizar.enlaceVencido };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, message: mensajes.comun.errorInesperado };
  }
  return { ok: true, message: mensajes.auth.actualizar.exito };
}
