import "server-only";

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Guard del panel superadmin. Defensa en profundidad (CLAUDE.md §4): la BD ya
 * bloquea las RPCs de plataforma, pero la UI tampoco debe exponer la sección.
 * La autoridad sigue siendo PostgreSQL; aquí solo decidimos qué renderizar.
 */

/** ¿El usuario actual tiene el flag `profiles.is_superadmin`? Sin sesión: false. */
export async function esSuperadmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();

  return data?.is_superadmin === true;
}

/** Exige superadmin; si no lo es (o no hay sesión), responde 404 y no revela la ruta. */
export async function requireSuperadmin(): Promise<void> {
  if (!(await esSuperadmin())) notFound();
}
