import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { DESTINO_ONBOARDING, resolveSafeNext } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirmación de correo (y otros enlaces OTP de Supabase Auth).
 * El enlace del correo llega con token_hash + type; se verifica en el
 * servidor y se redirige al destino seguro. URL a configurar en Supabase:
 * {NEXT_PUBLIC_APP_URL}/confirmar (ver docs/auth/authentication-flow.md).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = resolveSafeNext(searchParams.get("next"), DESTINO_ONBOARDING);

  if (isSupabaseConfigured() && tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/iniciar-sesion?error=enlace-invalido");
}
