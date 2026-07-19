import "server-only";

import type { Tables } from "@dogtoralia/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const COOKIE_CLINICA_ACTIVA = "dt_clinica_activa";

export interface ContextoUsuario {
  userId: string;
  email: string | null;
  profile: Tables<"profiles"> | null;
}

export interface MembresiaOrganizacion {
  id: string;
  role: Tables<"organization_members">["role"];
  organization: Tables<"organizations">;
}

export interface ContextoTenancy extends ContextoUsuario {
  /** Membresía de organización activa (Fase 3: la más antigua). */
  membership: MembresiaOrganizacion | null;
  /** Clínicas visibles de la organización activa (RLS decide). */
  clinics: Tables<"clinics">[];
  /** Clínica activa: cookie validada contra las clínicas visibles. */
  activeClinic: Tables<"clinics"> | null;
  /** Membresías de clínica activas del usuario (para roles en UI). */
  clinicMemberships: Tables<"clinic_members">[];
}

/** Usuario autenticado + su perfil; redirige a iniciar sesión si no hay sesión. */
export async function requireUser(): Promise<ContextoUsuario> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/iniciar-sesion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, email: user.email ?? null, profile: profile ?? null };
}

/**
 * Contexto completo de tenancy. La clínica activa NUNCA se toma a ciegas de la
 * cookie: se valida contra las clínicas que RLS deja ver. PostgreSQL es la
 * autoridad; la cookie solo es preferencia de UX.
 */
export async function getTenancyContext(): Promise<ContextoTenancy> {
  const base = await requireUser();
  const supabase = await createClient();

  const { data: membershipRows } = await supabase
    .from("organization_members")
    .select("id, role, created_at, organizations(*)")
    .eq("user_id", base.userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const first = membershipRows?.find((row) => row.organizations !== null);
  const membership: MembresiaOrganizacion | null = first
    ? {
        id: first.id,
        role: first.role,
        organization: first.organizations as Tables<"organizations">,
      }
    : null;

  if (!membership) {
    return { ...base, membership: null, clinics: [], activeClinic: null, clinicMemberships: [] };
  }

  const [{ data: clinics }, { data: clinicMemberships }] = await Promise.all([
    supabase
      .from("clinics")
      .select("*")
      .eq("organization_id", membership.organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("clinic_members")
      .select("*")
      .eq("user_id", base.userId)
      .eq("status", "active")
      .is("deleted_at", null),
  ]);

  const visibles = clinics ?? [];
  const cookieStore = await cookies();
  const preferida = cookieStore.get(COOKIE_CLINICA_ACTIVA)?.value;
  const activeClinic = visibles.find((c) => c.id === preferida) ?? visibles[0] ?? null;

  return {
    ...base,
    membership,
    clinics: visibles,
    activeClinic,
    clinicMemberships: clinicMemberships ?? [],
  };
}

/** Contexto que exige organización activa; sin ella, manda al onboarding. */
export async function requireTenancyContext(): Promise<
  ContextoTenancy & { membership: MembresiaOrganizacion }
> {
  const context = await getTenancyContext();
  if (!context.membership) redirect("/app/onboarding");
  return context as ContextoTenancy & { membership: MembresiaOrganizacion };
}
