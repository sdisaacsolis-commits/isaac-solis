import { Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { formatearFecha } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { obtenerMisCitasReseñables } from "@/lib/portal/reviews";

import { OpinionCita } from "./opinion-cita";

const t = mensajes.resenas.mi;

export const metadata: Metadata = { title: t.titulo };

export default async function PaginaMisOpiniones() {
  const citas = await obtenerMisCitasReseñables();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="mt-1 text-ink-muted">{t.descripcion}</p>
      </div>

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
                    {cita.pet_name} · {cita.clinic_name}
                  </CardTitle>
                  {cita.completed_at ? (
                    <span className="text-sm text-ink-muted">
                      {t.atendida}: {formatearFecha(cita.completed_at)}
                    </span>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-ink-muted">
                  {mensajes.agenda.columnaFolio}:{" "}
                  <span className="font-mono text-ink">{cita.folio}</span>
                  {cita.veterinarian ? (
                    <>
                      {" · "}
                      {t.veterinario}: <span className="text-ink">{cita.veterinarian}</span>
                    </>
                  ) : null}
                </p>
                <OpinionCita cita={cita} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
