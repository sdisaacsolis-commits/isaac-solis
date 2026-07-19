import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatearFechaHora, formatearPrecioMXN } from "@/lib/agenda/dates";
import { listarVeterinarios, obtenerCita } from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { CancelarCitaForm, ReagendarCitaForm, TransicionesCita } from "./acciones-cita";

export const metadata: Metadata = { title: mensajes.agenda.detalle.titulo };

const t = mensajes.agenda;
const d = mensajes.agenda.detalle;

const PUEDE_CANCELAR = ["requested", "pending_confirmation", "confirmed", "checked_in"];
const PUEDE_REAGENDAR = ["requested", "pending_confirmation", "confirmed"];

export default async function PaginaDetalleCita({ params }: { params: Promise<{ id: string }> }) {
  const [context, { id }] = await Promise.all([requireTenancyContext(), params]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }
  const detalle = await obtenerCita(id);
  if (!detalle) notFound();
  const { cita, mascota, propietario, servicios, historial, notificaciones } = detalle;
  const tz = context.activeClinic.timezone;
  const veterinarios = await listarVeterinarios(cita.clinic_id);
  const veterinario = veterinarios.find(
    (v) => v.clinicMemberId === cita.veterinarian_clinic_member_id,
  );
  const total = servicios.reduce((suma, s) => suma + s.price_cents * s.quantity, 0);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {d.titulo} {cita.folio}
        </h1>
        <Badge>{t.estados[cita.status] ?? cita.status}</Badge>
        {cita.emergency ? <Badge variant="destructive">{t.urgencia}</Badge> : null}
        {cita.source === "walk_in" ? <Badge variant="warning">{t.walkIn}</Badge> : null}
      </div>

      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-muted">{d.fecha}</dt>
              <dd className="font-medium text-ink">
                {formatearFechaHora(cita.scheduled_start, tz)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.veterinario}</dt>
              <dd className="font-medium text-ink">{veterinario?.nombre ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.mascota}</dt>
              <dd className="font-medium text-ink">
                {mascota ? (
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/mascotas/${mascota.id}`}
                  >
                    {mascota.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.propietario}</dt>
              <dd className="font-medium text-ink">
                {propietario ? (
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/propietarios/${propietario.id}`}
                  >
                    {propietario.display_name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {cita.reason ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-ink-muted">{d.motivo}</dt>
                <dd className="text-ink">{cita.reason}</dd>
              </div>
            ) : null}
            {cita.staff_notes ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-ink-muted">{d.notas}</dt>
                <dd className="whitespace-pre-line text-ink">{cita.staff_notes}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.servicios}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{mensajes.servicios.columnaServicio}</TableHead>
                <TableHead>{mensajes.servicios.columnaDuracion}</TableHead>
                <TableHead>{mensajes.servicios.columnaPrecio}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicios.map((servicio) => (
                <TableRow key={servicio.id}>
                  <TableCell>{servicio.service_name}</TableCell>
                  <TableCell>{mensajes.servicios.minutos(servicio.duration_minutes)}</TableCell>
                  <TableCell>{formatearPrecioMXN(servicio.price_cents)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">{d.total}</TableCell>
                <TableCell />
                <TableCell className="font-semibold">{formatearPrecioMXN(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.acciones}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <TransicionesCita appointmentId={cita.id} estado={cita.status} />
          {PUEDE_REAGENDAR.includes(cita.status) ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink">{d.reagendar}</h3>
              <ReagendarCitaForm appointmentId={cita.id} veterinarios={veterinarios} />
            </div>
          ) : null}
          {PUEDE_CANCELAR.includes(cita.status) ? (
            <CancelarCitaForm appointmentId={cita.id} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.historial}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-2">
            {historial.map((evento) => (
              <li key={evento.id} className="text-sm text-ink">
                <span className="text-ink-muted">
                  {formatearFechaHora(evento.created_at, tz)} ·{" "}
                </span>
                {evento.from_status ? `${t.estados[evento.from_status]} → ` : ""}
                <strong>{t.estados[evento.to_status] ?? evento.to_status}</strong>
                {evento.reason ? ` — ${evento.reason}` : ""}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {notificaciones.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.notificaciones}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm text-ink">
              {notificaciones.map((notificacion) => (
                <li key={notificacion.id}>
                  {notificacion.type} · {notificacion.channel} ·{" "}
                  {formatearFechaHora(notificacion.scheduled_for, tz)} ·{" "}
                  <Badge
                    variant={
                      notificacion.status === "sent"
                        ? "success"
                        : notificacion.status === "failed"
                          ? "destructive"
                          : "neutral"
                    }
                  >
                    {notificacion.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
