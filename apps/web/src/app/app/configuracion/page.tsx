import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { cerrarSesion } from "@/lib/auth/actions";
import { mensajes } from "@/lib/i18n/es-mx";
import { puedeAdministrarClinica } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getTenancyContext } from "@/lib/tenancy/queries";

import { ClinicaPublicaForm } from "./clinica-publica-form";
import { PerfilPublicoForm } from "./perfil-publico-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: mensajes.configuracion.titulo };

const t = mensajes.configuracion;

export default async function PaginaConfiguracion() {
  const context = await getTenancyContext();
  const { profile } = context;

  // Perfil público: solo para quien es veterinario en alguna clínica.
  const esVeterinario = context.clinicMemberships.some((m) => m.role === "veterinarian");
  let perfilPublico: {
    slug: string;
    headline: string;
    bio: string;
    isPublic: boolean;
  } | null = null;
  if (esVeterinario && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("veterinarian_public_profiles")
      .select("slug, headline, bio, is_public")
      .eq("user_id", context.userId)
      .is("deleted_at", null)
      .maybeSingle();
    perfilPublico = {
      slug: data?.slug ?? "",
      headline: data?.headline ?? "",
      bio: data?.bio ?? "",
      isPublic: data?.is_public ?? false,
    };
  }

  // Visibilidad pública de la clínica activa: solo administración.
  const clinicaActiva = context.activeClinic;
  const rolEnClinicaActiva = clinicaActiva
    ? context.clinicMemberships.find((m) => m.clinic_id === clinicaActiva.id)?.role
    : undefined;
  const administraClinica =
    clinicaActiva !== null && puedeAdministrarClinica(context.membership?.role, rolEnClinicaActiva);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.perfil}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              firstName: profile?.first_name ?? "",
              lastName: profile?.last_name ?? "",
              displayName: profile?.display_name ?? "",
              phone: profile?.phone ?? "",
              timezone: profile?.timezone ?? "America/Mexico_City",
            }}
          />
        </CardContent>
      </Card>

      {perfilPublico ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.perfilPublico.titulo}</CardTitle>
            <CardDescription>{t.perfilPublico.descripcion}</CardDescription>
          </CardHeader>
          <CardContent>
            <PerfilPublicoForm defaults={perfilPublico} />
          </CardContent>
        </Card>
      ) : null}

      {clinicaActiva && administraClinica ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.clinicaPublica.titulo}</CardTitle>
            <CardDescription>{t.clinicaPublica.descripcion}</CardDescription>
          </CardHeader>
          <CardContent>
            <ClinicaPublicaForm
              clinicId={clinicaActiva.id}
              slug={clinicaActiva.slug}
              isPublic={clinicaActiva.is_public}
              acceptsOnlineBooking={clinicaActiva.accepts_online_booking}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.seguridad}</CardTitle>
          <CardDescription>{t.descripcionCambio}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/actualizar-contrasena">{t.cambiarContrasena}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.sesion}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={cerrarSesion}>
            <Button type="submit" variant="destructive">
              {mensajes.auth.cerrarSesion}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
