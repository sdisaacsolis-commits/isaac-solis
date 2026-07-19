import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEstadoClinica } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.panel.nav.inicio };

const t = mensajes.panel;

export default async function PaginaInicioPanel({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  const supabase = await createClient();

  const [{ count: miembrosActivos }, { count: invitacionesPendientes }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.membership.organization.id)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("clinic_invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const clinica = context.activeClinic;

  return (
    <div className="flex flex-col gap-6">
      {params.bienvenida ? <Alert variant="success">{mensajes.invitacion.exito}</Alert> : null}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {t.saludo}, {context.profile?.display_name ?? context.email}
        </h1>
        <p className="mt-1 text-ink-muted">
          {t.organizacionActiva}: <strong>{context.membership.organization.name}</strong>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t.clinicaActiva}</CardDescription>
            <CardTitle className="text-lg">{clinica ? clinica.name : t.sinClinica}</CardTitle>
          </CardHeader>
          <CardContent>
            {clinica ? (
              <Badge variant={clinica.status === "active" ? "success" : "warning"}>
                {etiquetasEstadoClinica[clinica.status]}
              </Badge>
            ) : (
              <Button asChild size="sm">
                <Link href="/app/clinicas">{mensajes.clinicas.crearPrimera}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t.miembrosActivos}</CardDescription>
            <CardTitle className="text-3xl">{miembrosActivos ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-brand-700 hover:underline" href="/app/personal">
              {t.verPersonal}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t.invitacionesPendientes}</CardDescription>
            <CardTitle className="text-3xl">{invitacionesPendientes ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-brand-700 hover:underline" href="/app/personal">
              {mensajes.personal.invitaciones.titulo}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{mensajes.panel.nav.clinicas}</CardDescription>
            <CardTitle className="text-3xl">{context.clinics.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-brand-700 hover:underline" href="/app/clinicas">
              {t.verClinicas}
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {t.proximamenteAgenda.titulo}
              <Badge variant="brand">{mensajes.comun.proximamente}</Badge>
            </CardTitle>
            <CardDescription>{t.proximamenteAgenda.texto}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {t.proximamentePacientes.titulo}
              <Badge variant="brand">{mensajes.comun.proximamente}</Badge>
            </CardTitle>
            <CardDescription>{t.proximamentePacientes.texto}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
