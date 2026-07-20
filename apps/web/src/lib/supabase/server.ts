import "server-only";

import type { Database } from "@dogtoralia/types";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./config";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa las cookies gestionadas por el SDK oficial (@supabase/ssr); nunca se
 * manipulan tokens a mano ni se usa la service_role en esta app.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component (solo lectura de cookies):
          // el middleware se encarga de refrescar la sesión.
        }
      },
    },
  });
}
