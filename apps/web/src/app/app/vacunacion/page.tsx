import type { VaccinationRecordStatus, VaccinationSource } from "@dogtoralia/types";
import { VACCINATION_RECORD_STATUSES, VACCINATION_SOURCES } from "@dogtoralia/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
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

import { formatearFechaHora, formatearFechaLarga } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";
import { varianteEstadoVacunacion, varianteFuenteVacunacion } from "@/lib/vacunacion/presentacion";
import {
  listarVacunaciones,
  proximasDosis,
  TAMANO_PAGINA_VACUNACION,
} from "@/lib/vacunacion/queries";

export const metadata: Metadata = { title: mensajes.vacunacion.titulo };

const t = mensajes.vacunacion;

export default async function PaginaVacunacion({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; fuente?: string; vacuna?: string; page?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }
  const clinica = context.activeClinic;

  const estado = VACCINATION_RECORD_STATUSES.includes(params.estado as VaccinationRecordStatus)
    ? (params.estado as VaccinationRecordStatus)
    : undefined;
  const fuente = VACCINATION_SOURCES.includes(params.fuente as VaccinationSource)
    ? (params.fuente as VaccinationSource)
    : undefined;
  const vacuna = params.vacuna?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [{ filas, total }, proximas] = await Promise.all([
    listarVacunaciones({
      clinicId: clinica.id,
      timezone: clinica.timezone,
      filtros: { estado, fuente, vacuna, page },
    }),
    proximasDosis(clinica.id, clinica.timezone),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_VACUNACION));
  const enlacePagina = (destino: number) => {
    const query = new URLSearchParams();
    if (estado) query.set("estado", estado);
    if (fuente) query.set("fuente", fuente);
    if (vacuna) query.set("vacuna", vacuna);
    query.set("page", String(destino));
    return `/app/vacunacion?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
          <p className="text-sm text-ink-muted">{t.descripcion}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/configuracion/vacunas">{t.catalogo.titulo}</Link>
          </Button>
          <Button asChild>
            <Link href="/app/vacunacion/nueva">{t.registrar}</Link>
          </Button>
        </div>
      </div>

      <Alert>{t.aviso}</Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.proximasDosis}</CardTitle>
        </CardHeader>
        <CardContent>
          {proximas.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sinProximas}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columnaProximaDosis}</TableHead>
                  <TableHead>{t.columnaMascota}</TableHead>
                  <TableHead>{t.columnaVacuna}</TableHead>
                  <TableHead>{t.columnaFuente}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proximas.map(({ registro, mascota }) => (
                  <TableRow key={registro.id}>
                    <TableCell className="whitespace-nowrap">
                      {registro.next_due_at
                        ? formatearFechaLarga(registro.next_due_at, clinica.timezone)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {mascota ? (
                        <Link
                          className="font-medium text-brand-700 hover:underline"
                          href={`/app/mascotas/${mascota.id}/vacunacion`}
                        >
                          {mascota.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        className="text-brand-700 hover:underline"
                        href={`/app/vacunacion/${registro.id}`}
                      >
                        {registro.vaccine_name_snapshot}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={varianteFuenteVacunacion(registro.source)}>
                        {t.fuentes[registro.source] ?? registro.source}
                      </Badge>
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
          <CardTitle className="text-base">{t.titulo}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="estado" className="text-sm font-medium text-ink">
                {t.filtroEstado}
              </label>
              <Select id="estado" name="estado" defaultValue={estado ?? ""}>
                <option value="">{t.todos}</option>
                {VACCINATION_RECORD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t.estados[s] ?? s}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fuente" className="text-sm font-medium text-ink">
                {t.filtroFuente}
              </label>
              <Select id="fuente" name="fuente" defaultValue={fuente ?? ""}>
                <option value="">{t.todas}</option>
                {VACCINATION_SOURCES.map((f) => (
                  <option key={f} value={f}>
                    {t.fuentes[f] ?? f}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="vacuna" className="text-sm font-medium text-ink">
                {t.filtroVacuna}
              </label>
              <Input id="vacuna" name="vacuna" defaultValue={vacuna ?? ""} />
            </div>
            <Button type="submit" variant="outline">
              {t.filtrar}
            </Button>
          </form>

          {filas.length === 0 ? (
            <p className="text-ink-muted">{t.sinRegistros}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columnaFecha}</TableHead>
                  <TableHead>{t.columnaMascota}</TableHead>
                  <TableHead>{t.columnaVacuna}</TableHead>
                  <TableHead>{t.columnaLote}</TableHead>
                  <TableHead>{t.columnaProximaDosis}</TableHead>
                  <TableHead>{t.columnaFuente}</TableHead>
                  <TableHead>{t.columnaEstado}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map(({ registro, mascota }) => (
                  <TableRow key={registro.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatearFechaHora(registro.administered_at, clinica.timezone)}
                    </TableCell>
                    <TableCell>{mascota?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Link
                        className={`font-medium text-brand-700 hover:underline ${
                          registro.status === "voided" ? "line-through" : ""
                        }`}
                        href={`/app/vacunacion/${registro.id}`}
                      >
                        {registro.vaccine_name_snapshot}
                      </Link>
                    </TableCell>
                    <TableCell>{registro.lot_number ?? "—"}</TableCell>
                    <TableCell>{registro.next_due_at ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={varianteFuenteVacunacion(registro.source)}>
                        {t.fuentes[registro.source] ?? registro.source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={varianteEstadoVacunacion(registro.status)}>
                        {t.estados[registro.status] ?? registro.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPaginas > 1 ? (
            <nav aria-label={t.titulo} className="flex items-center gap-4 text-sm">
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
