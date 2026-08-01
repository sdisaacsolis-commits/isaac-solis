import type { PrescriptionStatus } from "@dogtoralia/types";
import { PRESCRIPTION_STATUSES } from "@dogtoralia/types";
import {
  Alert,
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

import { formatearFechaHora } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { varianteEstadoReceta } from "@/lib/recetas/presentacion";
import { listarRecetas, TAMANO_PAGINA_RECETAS } from "@/lib/recetas/queries";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.recetas.titulo };

const t = mensajes.recetas;

export default async function PaginaRecetas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; page?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }
  const clinica = context.activeClinic;

  const estado = PRESCRIPTION_STATUSES.includes(params.estado as PrescriptionStatus)
    ? (params.estado as PrescriptionStatus)
    : undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const { filas, total } = await listarRecetas({ clinicId: clinica.id, estado, page });
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_RECETAS));
  const enlacePagina = (destino: number) => {
    const query = new URLSearchParams();
    if (estado) query.set("estado", estado);
    query.set("page", String(destino));
    return `/app/recetas?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
          <p className="text-sm text-ink-muted">{t.descripcion}</p>
        </div>
        <Button asChild>
          <Link href="/app/recetas/nueva">{t.nueva}</Link>
        </Button>
      </div>

      <Alert>{t.aviso}</Alert>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado" className="text-sm font-medium text-ink">
            {t.filtroEstado}
          </label>
          <Select id="estado" name="estado" defaultValue={estado ?? ""}>
            <option value="">{t.todas}</option>
            {PRESCRIPTION_STATUSES.map((s) => (
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

      {filas.length === 0 ? (
        <p className="text-ink-muted">{t.sinRecetas}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnaFolio}</TableHead>
              <TableHead>{t.columnaFecha}</TableHead>
              <TableHead>{t.columnaPaciente}</TableHead>
              <TableHead>{t.columnaVeterinario}</TableHead>
              <TableHead>{t.columnaVigencia}</TableHead>
              <TableHead>{t.columnaEstado}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map(({ receta, mascota, veterinario }) => (
              <TableRow key={receta.id}>
                <TableCell>
                  <Link
                    className="font-medium text-brand-700 hover:underline"
                    href={`/app/recetas/${receta.id}`}
                  >
                    {receta.folio ?? t.borradorSinFolio}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatearFechaHora(receta.issued_at ?? receta.created_at, clinica.timezone)}
                </TableCell>
                <TableCell>{mascota?.name ?? "—"}</TableCell>
                <TableCell>{veterinario ?? "—"}</TableCell>
                <TableCell>{receta.valid_until ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={varianteEstadoReceta(receta.status)}>
                    {t.estados[receta.status] ?? receta.status}
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
    </div>
  );
}
