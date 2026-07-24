import { DEFAULT_TIMEZONE } from "@dogtoralia/types";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { obtenerHistorialDeMiMascota, obtenerMisMascotas } from "@/lib/portal/mi";

const t = mensajes.mi.historial;

export const metadata: Metadata = { title: mensajes.mi.mascotas.titulo };

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(iso));
}

function formatearFechaCorta(fecha: string): string {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${fecha.slice(0, 10)}T12:00:00Z`),
  );
}

export default async function PaginaHistorialMascota({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [historial, mascotas] = await Promise.all([
    obtenerHistorialDeMiMascota(id),
    obtenerMisMascotas(),
  ]);
  // PERMISO_DENEGADO o mascota inexistente → 404 (nunca se filtra existencia).
  if (!historial) notFound();
  const mascota = mascotas.find((m) => m.pet_id === id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link className="text-sm text-brand-700 hover:underline" href="/mi/mascotas">
          {t.volver}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
          {t.titulo} {mascota?.name ?? ""}
        </h1>
      </div>

      <Alert variant="info">{t.soloLectura}</Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.consultas}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {historial.encounters.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sinConsultas}</p>
          ) : (
            historial.encounters.map((consulta) => (
              <div
                key={consulta.folio}
                className="rounded-lg border border-border px-4 py-3 text-sm"
              >
                <p className="font-medium text-ink">
                  {consulta.folio} · {consulta.clinic_name}
                </p>
                <p className="text-ink-muted">
                  {formatearFechaHora(consulta.started_at, DEFAULT_TIMEZONE)}
                  {consulta.chief_complaint ? ` · ${t.motivo}: ${consulta.chief_complaint}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.recetas}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {historial.prescriptions.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sinRecetas}</p>
          ) : (
            historial.prescriptions.map((receta, indice) => (
              <div
                key={receta.folio ?? indice}
                className="rounded-lg border border-border px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">
                    {receta.folio ?? "—"} · {receta.clinic_name}
                  </p>
                  <Badge>{mensajes.recetas.estados[receta.status] ?? receta.status}</Badge>
                </div>
                {receta.issued_at ? (
                  <p className="text-ink-muted">{formatearFecha(receta.issued_at)}</p>
                ) : null}
                {(receta.items ?? []).length > 0 ? (
                  <ul className="mt-2 list-inside list-disc text-ink">
                    {(receta.items ?? []).map((partida, i) => (
                      <li key={`${partida.medication_name}-${i}`}>
                        <span className="font-medium">{partida.medication_name}</span>
                        {[partida.dosage_text, partida.frequency_text, partida.duration_text]
                          .filter(Boolean)
                          .map((detalle) => ` · ${detalle}`)
                          .join("")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.vacunas}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {historial.vaccinations.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sinVacunas}</p>
          ) : (
            historial.vaccinations.map((vacuna, indice) => (
              <div
                key={`${vacuna.vaccine_name}-${indice}`}
                className="rounded-lg border border-border px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{vacuna.vaccine_name}</p>
                  <Badge>{mensajes.vacunacion.fuentes[vacuna.source] ?? vacuna.source}</Badge>
                  {vacuna.status !== "recorded" ? (
                    <Badge variant="destructive">
                      {mensajes.vacunacion.estados[vacuna.status] ?? vacuna.status}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-ink-muted">
                  {formatearFechaCorta(vacuna.administered_at)} · {vacuna.clinic_name}
                  {vacuna.next_due_at
                    ? ` · ${t.proximaDosis}: ${formatearFechaCorta(vacuna.next_due_at)}`
                    : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
