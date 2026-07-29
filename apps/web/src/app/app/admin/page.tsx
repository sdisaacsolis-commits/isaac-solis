import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { requireSuperadmin } from "@/lib/admin/guard";
import { obtenerPanorama } from "@/lib/admin/queries";
import { mensajes } from "@/lib/i18n/es-mx";

export const metadata: Metadata = { title: mensajes.admin.nav.panorama };

const t = mensajes.admin.panorama;

function TarjetaMetrica({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-2xl">{valor}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export default async function PaginaAdminPanorama() {
  await requireSuperadmin();
  const panorama = await obtenerPanorama();

  if (!panorama) {
    return <Alert variant="warning">{mensajes.comun.sinDatos}</Alert>;
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-ink">{t.titulo}</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaMetrica titulo={t.organizaciones} valor={panorama.organizaciones.total} />
        <TarjetaMetrica titulo={t.clinicas} valor={panorama.clinicas.total} />
        <TarjetaMetrica titulo={t.veterinariosActivos} valor={panorama.veterinariosActivos} />
        <TarjetaMetrica titulo={t.mascotas} valor={panorama.mascotas} />
      </div>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">{t.organizaciones}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [t.total, panorama.organizaciones.total],
              [t.estadosOrganizacion.active, panorama.organizaciones.active],
              [t.estadosOrganizacion.suspended, panorama.organizaciones.suspended],
              [t.estadosOrganizacion.archived, panorama.organizaciones.archived],
            ] as const
          ).map(([titulo, valor]) => (
            <div key={titulo} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm text-ink-muted">{titulo}</p>
              <p className="text-xl font-semibold text-ink">{valor}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">{t.clinicas}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [t.total, panorama.clinicas.total],
              [t.estadosClinica.trial, panorama.clinicas.trial],
              [t.estadosClinica.active, panorama.clinicas.active],
              [t.estadosClinica.past_due, panorama.clinicas.past_due],
              [t.estadosClinica.suspended, panorama.clinicas.suspended],
              [t.estadosClinica.cancelled, panorama.clinicas.cancelled],
              [t.estadosClinica.archived, panorama.clinicas.archived],
            ] as const
          ).map(([titulo, valor]) => (
            <div key={titulo} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm text-ink-muted">{titulo}</p>
              <p className="text-xl font-semibold text-ink">{valor}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TarjetaMetrica titulo={t.propietarios} valor={panorama.propietarios} />
        <TarjetaMetrica titulo={t.mascotas} valor={panorama.mascotas} />
        <TarjetaMetrica titulo={t.citas} valor={panorama.citas.total} />
      </div>

      <Card>
        <CardHeader className="p-4">
          <CardTitle className="text-base">{t.citas}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [t.total, panorama.citas.total],
              [t.citasUltimos30, panorama.citas.ultimos30Dias],
              [t.citasCompletadas, panorama.citas.completadas],
              [t.citasCanceladas, panorama.citas.canceladas],
            ] as const
          ).map(([titulo, valor]) => (
            <div key={titulo} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm text-ink-muted">{titulo}</p>
              <p className="text-xl font-semibold text-ink">{valor}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
