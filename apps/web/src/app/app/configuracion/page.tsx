import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { cerrarSesion } from "@/lib/auth/actions";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireUser } from "@/lib/tenancy/queries";

import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: mensajes.configuracion.titulo };

const t = mensajes.configuracion;

export default async function PaginaConfiguracion() {
  const { profile } = await requireUser();

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
