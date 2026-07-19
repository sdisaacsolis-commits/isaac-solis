import { env } from "@/env";

/**
 * Supabase es opcional en desarrollo temprano: sin configuración, las rutas
 * privadas redirigen a iniciar sesión y las acciones devuelven un error claro
 * en lugar de romper la aplicación.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}
