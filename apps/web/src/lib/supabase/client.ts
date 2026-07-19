import type { Database } from "@dogtoralia/types";
import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./config";

/** Cliente de Supabase para componentes de cliente (solo llave anon + RLS). */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
