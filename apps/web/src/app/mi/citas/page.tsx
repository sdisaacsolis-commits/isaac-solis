import { Badge, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { formatearFechaHora } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { obtenerMisCitas } from "@/lib/portal/mi";

import { CancelarCitaForm } from "./cancelar-cita-form";

const t = mensajes.mi.citas;

export const metadata: Metadata = { title: t.titulo };

const CANCELABLES = new Set(["requested", "pending_confirmation", "confirmed"]);

function varianteEstado(estado: string) {
  if (estado === "completed") return "success" as const;
  if (estado === "cancelled" || estado === "no_show") return "destructive" as const;
  return "brand" as const;
}

export default async function PaginaMisCitas() {
  const citas = await obtenerMisCitas();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>

      {citas.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted px-4 py-6 text-ink-muted">
          {t.vacio}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {citas.map((cita) => (
            <Card key={cita.appointment_id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {cita.pet_name} ·{" "}
                    {formatearFechaHora(cita.scheduled_start, cita.clinic_timezone)}
                  </CardTitle>
                  <Badge variant={varianteEstado(cita.status)}>
                    {mensajes.agenda.estados[cita.status] ?? cita.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="text-ink-muted">
                  {mensajes.agenda.columnaFolio}:{" "}
                  <span className="font-mono text-ink">{cita.folio}</span>
                </p>
                <p className="text-ink-muted">
                  {t.clinica}: <span className="text-ink">{cita.clinic_name}</span>
                  {cita.veterinarian ? (
                    <>
                      {" · "}
                      {t.veterinario}: <span className="text-ink">{cita.veterinarian}</span>
                    </>
                  ) : null}
                </p>
                {cita.reason ? (
                  <p className="text-ink-muted">
                    {t.motivo}: <span className="text-ink">{cita.reason}</span>
                  </p>
                ) : null}
                {CANCELABLES.has(cita.status) &&
                new Date(cita.scheduled_start).getTime() > Date.now() ? (
                  <CancelarCitaForm appointmentId={cita.appointment_id} />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
