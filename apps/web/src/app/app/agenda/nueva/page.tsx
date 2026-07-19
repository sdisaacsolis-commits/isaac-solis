import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Select } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { formatearHora, hoyEnZona, utcALocalInput } from "@/lib/agenda/dates";
import {
  listarPacientesParaAgenda,
  listarServicios,
  listarVeterinarios,
  obtenerDisponibilidad,
} from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: mensajes.agenda.nueva.titulo };

const t = mensajes.agenda.nueva;

export default async function PaginaNuevaCita({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string; servicio?: string; vet?: string; fecha?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.agenda.sinClinica}</p>;
  }
  const clinica = context.activeClinic;

  const [pacientes, servicios, veterinarios] = await Promise.all([
    listarPacientesParaAgenda(clinica.id),
    listarServicios(clinica.id, { soloActivos: true }),
    listarVeterinarios(clinica.id),
  ]);

  const paciente = pacientes.find((p) => `${p.petId}|${p.ownerId}` === params.paciente);
  const servicio = servicios.find((s) => s.id === params.servicio);
  const veterinario = veterinarios.find((v) => v.clinicMemberId === params.vet);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.fecha ?? "")
    ? params.fecha!
    : hoyEnZona(clinica.timezone);
  const seleccionCompleta = Boolean(paciente && servicio && veterinario);

  const slots = seleccionCompleta
    ? await obtenerDisponibilidad({
        clinicId: clinica.id,
        veterinarianMemberId: veterinario!.clinicMemberId,
        serviceId: servicio!.id,
        fromDate: fecha,
        toDate: fecha,
      })
    : [];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="text-sm text-ink-muted">{t.descripcion}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.pasoDatos}</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="paciente" className="text-sm font-medium text-ink">
                {t.mascota}
              </label>
              <Select id="paciente" name="paciente" defaultValue={params.paciente ?? ""} required>
                <option value="" disabled>
                  —
                </option>
                {pacientes.map((p) => (
                  <option key={p.petId} value={`${p.petId}|${p.ownerId}`}>
                    {p.etiqueta}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="servicio" className="text-sm font-medium text-ink">
                {t.servicio}
              </label>
              <Select id="servicio" name="servicio" defaultValue={params.servicio ?? ""} required>
                <option value="" disabled>
                  —
                </option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({mensajes.servicios.minutos(s.duration_minutes)})
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="vet" className="text-sm font-medium text-ink">
                {t.veterinario}
              </label>
              <Select id="vet" name="vet" defaultValue={params.vet ?? ""} required>
                <option value="" disabled>
                  —
                </option>
                {veterinarios.map((v) => (
                  <option key={v.clinicMemberId} value={v.clinicMemberId}>
                    {v.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fecha" className="text-sm font-medium text-ink">
                {t.fecha}
              </label>
              <input
                id="fecha"
                name="fecha"
                type="date"
                defaultValue={fecha}
                required
                className="flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline">
                {t.verDisponibilidad}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.pasoHorario}</CardTitle>
        </CardHeader>
        <CardContent>
          {seleccionCompleta ? (
            <BookingForm
              clinicId={clinica.id}
              petId={paciente!.petId}
              ownerId={paciente!.ownerId}
              veterinarianMemberId={veterinario!.clinicMemberId}
              serviceId={servicio!.id}
              slots={slots.map((slot) => [
                utcALocalInput(slot.slot_start, clinica.timezone),
                `${formatearHora(slot.slot_start, clinica.timezone)}–${formatearHora(
                  slot.slot_end,
                  clinica.timezone,
                )}`,
              ])}
            />
          ) : (
            <Alert>{t.faltanDatos}</Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
