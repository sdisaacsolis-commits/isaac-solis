import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
} from "@dogtoralia/ui";
import type { Metadata } from "next";

import { eliminarExcepcion } from "@/lib/agenda/actions";
import { formatearFechaHora } from "@/lib/agenda/dates";
import { listarExcepciones, listarHorario, listarVeterinarios } from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { ExceptionForm } from "./exception-form";
import { ScheduleForm } from "./schedule-form";

export const metadata: Metadata = { title: mensajes.horarios.titulo };

const t = mensajes.horarios;

export default async function PaginaHorarios({
  searchParams,
}: {
  searchParams: Promise<{ vet?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }
  const clinica = context.activeClinic;
  const veterinarios = await listarVeterinarios(clinica.id);
  const vetSeleccionado =
    veterinarios.find((v) => v.clinicMemberId === params.vet) ?? veterinarios[0];

  const [ventanas, excepciones] = await Promise.all([
    vetSeleccionado ? listarHorario(clinica.id, vetSeleccionado.clinicMemberId) : [],
    listarExcepciones(clinica.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="text-sm text-ink-muted">{t.descripcion}</p>
      </div>

      {veterinarios.length === 0 ? (
        <p className="text-ink-muted">{t.sinVeterinarios}</p>
      ) : (
        <>
          <form method="get" className="flex max-w-md items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="vet" className="text-sm font-medium text-ink">
                {t.elegirVeterinario}
              </label>
              <Select id="vet" name="vet" defaultValue={vetSeleccionado?.clinicMemberId}>
                {veterinarios.map((veterinario) => (
                  <option key={veterinario.clinicMemberId} value={veterinario.clinicMemberId}>
                    {veterinario.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">
              {t.ver}
            </Button>
          </form>

          {vetSeleccionado ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t.ventanas} — {vetSeleccionado.nombre}
                </CardTitle>
                <CardDescription>{t.descripcion}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScheduleForm
                  key={vetSeleccionado.clinicMemberId}
                  clinicId={clinica.id}
                  clinicMemberId={vetSeleccionado.clinicMemberId}
                  ventanasIniciales={ventanas.map((v) => ({
                    weekday: v.weekday,
                    startTime: v.start_time.slice(0, 5),
                    endTime: v.end_time.slice(0, 5),
                  }))}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.excepciones}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {excepciones.length === 0 ? (
                <p className="text-sm text-ink-muted">{t.sinExcepciones}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {excepciones.map((excepcion) => {
                    const vet = veterinarios.find(
                      (v) => v.clinicMemberId === excepcion.clinic_member_id,
                    );
                    return (
                      <li
                        key={excepcion.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span>
                          <strong>{t.tipos[excepcion.type] ?? excepcion.type}</strong> ·{" "}
                          {vet?.nombre ?? t.todaLaClinica} ·{" "}
                          {formatearFechaHora(excepcion.starts_at, clinica.timezone)} →{" "}
                          {formatearFechaHora(excepcion.ends_at, clinica.timezone)}
                          {excepcion.reason ? ` · ${excepcion.reason}` : ""}
                        </span>
                        <form action={eliminarExcepcion}>
                          <input type="hidden" name="exceptionId" value={excepcion.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {t.eliminar}
                          </Button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div>
                <h2 className="mb-3 text-sm font-semibold text-ink">{t.nuevaExcepcion}</h2>
                <ExceptionForm clinicId={clinica.id} veterinarios={veterinarios} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
