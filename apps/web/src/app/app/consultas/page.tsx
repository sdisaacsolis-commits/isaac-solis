import type { EncounterStatus } from "@dogtoralia/types";
import { ENCOUNTER_STATUSES } from "@dogtoralia/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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

import { formatearHora, hoyEnZona, sumarDias } from "@/lib/agenda/dates";
import { listarVeterinarios } from "@/lib/agenda/queries";
import { varianteEstadoConsulta } from "@/lib/clinica/presentacion";
import {
  listarConsultas,
  listarSalaDeEspera,
  TAMANO_PAGINA_CONSULTAS,
} from "@/lib/clinica/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { IniciarConsultaForm } from "./iniciar-consulta-form";

export const metadata: Metadata = { title: mensajes.consultas.titulo };

const t = mensajes.consultas;

/** Espera desde el registro de llegada, en lenguaje natural es-MX. */
function tiempoDeEspera(checkedInAt: string | null): string {
  if (!checkedInAt) return "—";
  const minutos = Math.max(0, Math.round((Date.now() - Date.parse(checkedInAt)) / 60_000));
  return new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" }).format(-minutos, "minute");
}

export default async function PaginaConsultas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; vet?: string; page?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }
  const clinica = context.activeClinic;
  const tz = clinica.timezone;

  const estado = ENCOUNTER_STATUSES.includes(params.estado as EncounterStatus)
    ? (params.estado as EncounterStatus)
    : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const veterinarios = await listarVeterinarios(clinica.id);
  const vet = veterinarios.find((v) => v.clinicMemberId === params.vet)?.clinicMemberId;

  const hoy = hoyEnZona(tz);
  const [salaDeEspera, consultasDelDia] = await Promise.all([
    listarSalaDeEspera(clinica.id, tz),
    listarConsultas({
      clinicId: clinica.id,
      timezone: tz,
      desde: hoy,
      hasta: sumarDias(hoy, 1),
      estado,
      veterinarianMemberId: vet,
      page,
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(consultasDelDia.total / TAMANO_PAGINA_CONSULTAS));
  const enlacePagina = (destino: number) => {
    const query = new URLSearchParams();
    if (estado) query.set("estado", estado);
    if (vet) query.set("vet", vet);
    query.set("page", String(destino));
    return `/app/consultas?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
          <p className="text-sm text-ink-muted">{t.descripcion}</p>
        </div>
        <Button asChild>
          <Link href="/app/consultas/nueva">{t.nuevaSinCita}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.salaDeEspera}</CardTitle>
        </CardHeader>
        <CardContent>
          {salaDeEspera.length === 0 ? (
            <p className="text-ink-muted">{t.sinPacientesEnEspera}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columnaHora}</TableHead>
                  <TableHead>{t.columnaPaciente}</TableHead>
                  <TableHead>{t.columnaVeterinario}</TableHead>
                  <TableHead>{t.columnaServicio}</TableHead>
                  <TableHead>{t.columnaEstado}</TableHead>
                  <TableHead>{t.columnaEspera}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaDeEspera.map(({ cita, mascota, propietario, servicios }) => (
                  <TableRow key={cita.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatearHora(cita.scheduled_start, tz)}
                    </TableCell>
                    <TableCell>
                      {mascota?.name ?? "—"}
                      <span className="text-ink-muted"> · {propietario?.display_name ?? "—"}</span>
                      {cita.emergency ? (
                        <Badge className="ml-2" variant="destructive">
                          {t.urgencia}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {veterinarios.find(
                        (v) => v.clinicMemberId === cita.veterinarian_clinic_member_id,
                      )?.nombre ?? "—"}
                    </TableCell>
                    <TableCell>{servicios.join(", ") || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          cita.status === "in_progress" || cita.status === "checked_in"
                            ? "warning"
                            : "brand"
                        }
                      >
                        {mensajes.agenda.estados[cita.status] ?? cita.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {tiempoDeEspera(cita.checked_in_at)}
                    </TableCell>
                    <TableCell>
                      <IniciarConsultaForm appointmentId={cita.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.consultasDelDia}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
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
                {ENCOUNTER_STATUSES.map((s) => (
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

          {consultasDelDia.filas.length === 0 ? (
            <p className="text-ink-muted">{t.sinConsultas}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columnaHora}</TableHead>
                  <TableHead>{t.columnaFolio}</TableHead>
                  <TableHead>{t.columnaPaciente}</TableHead>
                  <TableHead>{t.columnaVeterinario}</TableHead>
                  <TableHead>{t.columnaTipo}</TableHead>
                  <TableHead>{t.columnaEstado}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultasDelDia.filas.map(({ consulta, mascota, veterinario }) => (
                  <TableRow key={consulta.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatearHora(consulta.started_at, tz)}
                    </TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-brand-700 hover:underline"
                        href={`/app/consultas/${consulta.id}`}
                      >
                        {consulta.folio}
                      </Link>
                      {consulta.encounter_type === "emergency" ? (
                        <Badge className="ml-2" variant="destructive">
                          {t.urgencia}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{mascota?.name ?? "—"}</TableCell>
                    <TableCell>{veterinario ?? "—"}</TableCell>
                    <TableCell>
                      {t.tipos[consulta.encounter_type] ?? consulta.encounter_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant={varianteEstadoConsulta(consulta.status)}>
                        {t.estados[consulta.status] ?? consulta.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPaginas > 1 ? (
            <nav aria-label={t.consultasDelDia} className="flex items-center gap-4 text-sm">
              {page > 1 ? (
                <Link className="text-brand-700 hover:underline" href={enlacePagina(page - 1)}>
                  {mensajes.comun.paginaAnterior}
                </Link>
              ) : null}
              <span className="text-ink-muted">{mensajes.comun.paginaDe(page, totalPaginas)}</span>
              {page < totalPaginas ? (
                <Link className="text-brand-700 hover:underline" href={enlacePagina(page + 1)}>
                  {mensajes.comun.paginaSiguiente}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
