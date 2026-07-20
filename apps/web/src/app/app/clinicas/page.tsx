import {
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
import { etiquetasEstadoClinica, puedeAdministrarOrganizacion } from "@/lib/roles";
import { elegirClinicaActiva } from "@/lib/tenancy/actions";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { ClinicStep } from "../onboarding/clinic-step";

export const metadata: Metadata = { title: mensajes.clinicas.titulo };

const t = mensajes.clinicas;

export default async function PaginaClinicas() {
  const context = await requireTenancyContext();
  const esAdminOrg = puedeAdministrarOrganizacion(context.membership.role);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>

      {context.clinics.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.estadoVacio}</CardTitle>
            <CardDescription>{esAdminOrg ? t.crearPrimera : t.soloAdmins}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {context.clinics.map((clinica) => {
            const activa = context.activeClinic?.id === clinica.id;
            return (
              <Card key={clinica.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {clinica.name}
                    {activa ? <Badge variant="brand">{t.activa}</Badge> : null}
                  </CardTitle>
                  <CardDescription>
                    {[clinica.city, clinica.state].filter(Boolean).join(", ") ||
                      mensajes.comun.sinDatos}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                  <Badge variant={clinica.status === "active" ? "success" : "warning"}>
                    {etiquetasEstadoClinica[clinica.status]}
                  </Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/clinicas/${clinica.id}`}>{t.detalle}</Link>
                  </Button>
                  {!activa ? (
                    <form action={elegirClinicaActiva}>
                      <input type="hidden" name="clinicId" value={clinica.id} />
                      <input type="hidden" name="redirectTo" value="/app/clinicas" />
                      <Button type="submit" variant="ghost" size="sm">
                        {t.usarComoActiva}
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {esAdminOrg ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.nueva}</CardTitle>
            <CardDescription>{mensajes.clinicas.cicloVida}</CardDescription>
          </CardHeader>
          <CardContent>
            <ClinicStep organizationId={context.membership.organization.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
