import type { AppointmentStatus } from "@dogtoralia/types";
import { APPOINTMENT_STATUSES } from "@dogtoralia/types";
import {
  Badge,
  Button,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { formatearFechaLarga, formatearHora, hoyEnZona, sumarDias } from "@/lib/agenda/dates";
import type { FilaCita } from "@/lib/agenda/queries";
import { listarCitas, listarVeterinarios } from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.agenda.titulo };

const t = mensajes.agenda;
const VISTAS = ["dia", "semana", "lista"] as const;
type Vista = (typeof VISTAS)[number];

function varianteEstado(estado: AppointmentStatus) {
  if (estado === "completed") return "success" as const;
  if (estado === "cancelled" || estado === "no_show") return "destructive" as const;
  if (estado === "in_progress" || estado === "checked_in") return "warning" as const;
  return "brand" as const;
}

function TablaCitas({ filas, timezone }: { filas: FilaCita[]; timezone: string }) {
  if (filas.length === 0) return <p className="text-ink-muted">{t.sinCitas}</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.columnaHora}</TableHead>
          <TableHead>{t.columnaFolio}</TableHead>
          <TableHead>{t.columnaMascota}</TableHead>
          <TableHead>{t.columnaPropietario}</TableHead>
          <TableHead>{t.columnaServicios}</TableHead>
          <TableHead>{t.columnaEstado}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map(({ cita, mascota, propietario, servicios }) => (
          <TableRow key={cita.id}>
            <TableCell className="whitespace-nowrap">
              {formatearHora(cita.scheduled_start, timezone)}–
              {formatearHora(cita.scheduled_end, timezone)}
            </TableCell>
            <TableCell>
              <Link
                className="font-medium text-brand-700 hover:underline"
                href={`/app/agenda/${cita.id}`}
              >
                {cita.folio}
              </Link>
              {cita.emergency ? (
                <Badge className="ml-2" variant="destructive">
                  {t.urgencia}
                </Badge>
              ) : null}
            </TableCell>
            <TableCell>{mascota?.name ?? "—"}</TableCell>
            <TableCell>{propietario?.display_name ?? "—"}</TableCell>
            <TableCell>{servicios.join(", ") || "—"}</TableCell>
            <TableCell>
              <Badge variant={varianteEstado(cita.status)}>
                {t.estados[cita.status] ?? cita.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; vista?: string; vet?: string; estado?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }
  const clinica = context.activeClinic;
  const tz = clinica.timezone;

  const vista: Vista = VISTAS.includes(params.vista as Vista) ? (params.vista as Vista) : "dia";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(params.fecha ?? "") ? params.fecha! : hoyEnZona(tz);
  const estado = APPOINTMENT_STATUSES.includes(params.estado as AppointmentStatus)
    ? (params.estado as AppointmentStatus)
    : undefined;

  const veterinarios = await listarVeterinarios(clinica.id);
  const vet = veterinarios.find((v) => v.clinicMemberId === params.vet)?.clinicMemberId;

  const dias = vista === "dia" ? 1 : 7;
  const filas = await listarCitas({
    clinicId: clinica.id,
    timezone: tz,
    desde: fecha,
    hasta: sumarDias(fecha, dias),
    veterinarianMemberId: vet,
    estado,
  });

  const enlaceVista = (destino: {
    fecha?: string;
    vista?: Vista;
    vet?: string;
    estado?: string;
  }) => {
    const query = new URLSearchParams();
    query.set("fecha", destino.fecha ?? fecha);
    query.set("vista", destino.vista ?? vista);
    if (destino.vet ?? vet) query.set("vet", destino.vet ?? vet ?? "");
    if (destino.estado ?? estado) query.set("estado", destino.estado ?? estado ?? "");
    return `/app/agenda?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
          <p className="text-sm text-ink-muted">{t.descripcion}</p>
        </div>
        <Button asChild>
          <Link href="/app/agenda/nueva">{t.nuevaCita}</Link>
        </Button>
      </div>

      <nav aria-label={t.titulo} className="flex flex-wrap items-center gap-2">
        {VISTAS.map((v) => (
          <Button key={v} asChild size="sm" variant={v === vista ? "primary" : "outline"}>
            <Link href={enlaceVista({ vista: v })}>
              {v === "dia" ? t.vistaDia : v === "semana" ? t.vistaSemana : t.vistaLista}
            </Link>
          </Button>
        ))}
        <span aria-hidden="true" className="mx-2 h-5 w-px bg-border" />
        <Button asChild size="sm" variant="outline">
          <Link href={enlaceVista({ fecha: sumarDias(fecha, -dias) })}>{t.anterior}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={enlaceVista({ fecha: hoyEnZona(tz) })}>{t.hoy}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={enlaceVista({ fecha: sumarDias(fecha, dias) })}>{t.siguiente}</Link>
        </Button>
      </nav>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="vista" value={vista} />
        <input type="hidden" name="fecha" value={fecha} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vet" className="text-sm font-medium text-ink">
            {t.filtroVeterinario}
          </label>
          <Select id="vet" name="vet" defaultValue={vet ?? ""}>
            <option value="">{t.todos}</option>
            {veterinarios.map((veterinario) => (
              <option key={veterinario.clinicMemberId} value={veterinario.clinicMemberId}>
                {veterinario.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado" className="text-sm font-medium text-ink">
            {t.filtroEstado}
          </label>
          <Select id="estado" name="estado" defaultValue={estado ?? ""}>
            <option value="">{t.todas}</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.estados[s] ?? s}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          {t.filtrar}
        </Button>
      </form>

      <h2 className="text-lg font-semibold capitalize text-ink">
        {vista === "dia"
          ? formatearFechaLarga(fecha, tz)
          : `${formatearFechaLarga(fecha, tz)} — ${formatearFechaLarga(sumarDias(fecha, dias - 1), tz)}`}
      </h2>

      {vista === "semana" ? (
        <div className="flex flex-col gap-6">
          {Array.from({ length: 7 }, (_, i) => sumarDias(fecha, i)).map((dia) => {
            const delDia = filas.filter(
              ({ cita }) =>
                new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(
                  new Date(cita.scheduled_start),
                ) === dia,
            );
            if (delDia.length === 0) return null;
            return (
              <section key={dia} aria-label={formatearFechaLarga(dia, tz)}>
                <h3 className="mb-2 text-sm font-semibold capitalize text-ink-muted">
                  {formatearFechaLarga(dia, tz)}
                </h3>
                <TablaCitas filas={delDia} timezone={tz} />
              </section>
            );
          })}
          {filas.length === 0 ? <p className="text-ink-muted">{t.sinCitas}</p> : null}
        </div>
      ) : (
        <TablaCitas filas={filas} timezone={tz} />
      )}
    </div>
  );
}
