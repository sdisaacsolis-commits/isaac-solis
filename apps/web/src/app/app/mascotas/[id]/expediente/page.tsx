import type { EncounterStatus, EncounterType } from "@dogtoralia/types";
import { ENCOUNTER_STATUSES, ENCOUNTER_TYPES } from "@dogtoralia/types";
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
import { notFound } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora } from "@/lib/agenda/dates";
import { varianteEstadoConsulta } from "@/lib/clinica/presentacion";
import { expedienteDeMascota, TAMANO_PAGINA_CONSULTAS } from "@/lib/clinica/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.consultas.expediente.titulo };

const t = mensajes.consultas;
const e = mensajes.consultas.expediente;

export default async function PaginaExpedienteMascota({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string; tipo?: string; page?: string }>;
}) {
  const [context, { id }, query] = await Promise.all([
    requireTenancyContext(),
    params,
    searchParams,
  ]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }
  const clinica = context.activeClinic;

  const supabase = await createClient();
  const { data: mascota } = await supabase
    .from("pets")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!mascota) notFound();

  const estado = ENCOUNTER_STATUSES.includes(query.estado as EncounterStatus)
    ? (query.estado as EncounterStatus)
    : undefined;
  const tipo = ENCOUNTER_TYPES.includes(query.tipo as EncounterType)
    ? (query.tipo as EncounterType)
    : undefined;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const { filas, total } = await expedienteDeMascota({
    petId: mascota.id,
    clinicId: clinica.id,
    estado,
    tipo,
    page,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_CONSULTAS));
  const enlacePagina = (destino: number) => {
    const parametros = new URLSearchParams();
    if (estado) parametros.set("estado", estado);
    if (tipo) parametros.set("tipo", tipo);
    parametros.set("page", String(destino));
    return `/app/mascotas/${mascota.id}/expediente?${parametros.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          className="text-sm text-brand-700 hover:underline"
          href={`/app/mascotas/${mascota.id}`}
        >
          {e.volverAMascota}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          {e.titulo} — {mascota.name}
        </h1>
        <p className="text-sm text-ink-muted">{e.descripcion}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tipo" className="text-sm font-medium text-ink">
            {t.filtroTipo}
          </label>
          <Select id="tipo" name="tipo" defaultValue={tipo ?? ""}>
            <option value="">{t.todos}</option>
            {ENCOUNTER_TYPES.map((tipoConsulta) => (
              <option key={tipoConsulta} value={tipoConsulta}>
                {t.tipos[tipoConsulta] ?? tipoConsulta}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          {t.filtrar}
        </Button>
      </form>

      {filas.length === 0 ? (
        <p className="text-ink-muted">{e.sinConsultas}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnaFolio}</TableHead>
              <TableHead>{t.columnaFecha}</TableHead>
              <TableHead>{t.columnaTipo}</TableHead>
              <TableHead>{t.columnaMotivo}</TableHead>
              <TableHead>{t.columnaDiagnostico}</TableHead>
              <TableHead>{t.columnaEstado}</TableHead>
              <TableHead>{t.columnaVeterinario}</TableHead>
              <TableHead>{t.columnaArchivos}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map(({ consulta, veterinario, diagnosticoPrincipal, numeroArchivos }) => (
              <TableRow key={consulta.id}>
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
                <TableCell className="whitespace-nowrap">
                  {formatearFechaHora(consulta.started_at, clinica.timezone)}
                </TableCell>
                <TableCell>{t.tipos[consulta.encounter_type] ?? consulta.encounter_type}</TableCell>
                <TableCell className="max-w-56 truncate">
                  {consulta.chief_complaint ?? "—"}
                </TableCell>
                <TableCell>{diagnosticoPrincipal ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={varianteEstadoConsulta(consulta.status)}>
                    {t.estados[consulta.status] ?? consulta.status}
                  </Badge>
                </TableCell>
                <TableCell>{veterinario ?? "—"}</TableCell>
                <TableCell>{e.archivosCount(numeroArchivos)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPaginas > 1 ? (
        <nav aria-label={e.titulo} className="flex items-center gap-4 text-sm">
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
    </div>
  );
}
