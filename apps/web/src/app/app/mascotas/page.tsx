import { PET_SEXES, PET_SPECIES } from "@dogtoralia/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dogtoralia/ui";
import { clinicSearchSchema } from "@dogtoralia/validation";
import type { Metadata } from "next";
import Link from "next/link";

import { mensajes } from "@/lib/i18n/es-mx";
import {
  calcularEdad,
  etiquetasEspecie,
  etiquetasSexo,
  nombrePropietario,
} from "@/lib/pets/format";
import { listarMascotas, TAMANO_PAGINA } from "@/lib/pets/queries";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.pacientes.mascotas.titulo };

const t = mensajes.pacientes.mascotas;

export default async function PaginaMascotas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; species?: string; sex?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }

  const filtros = clinicSearchSchema.safeParse(params);
  const q = filtros.success ? filtros.data.q : undefined;
  const page = filtros.success ? filtros.data.page : 1;
  const species = filtros.success ? filtros.data.species : undefined;
  const sex = filtros.success ? filtros.data.sex : undefined;

  const { filas, total } = await listarMascotas({
    clinicId: context.activeClinic.id,
    q,
    species,
    sex,
    page,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <Button asChild>
          <Link href="/app/mascotas/nueva">{t.nueva}</Link>
        </Button>
      </div>

      <form method="get" className="flex max-w-2xl flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          {t.buscar}
        </label>
        <Input id="q" name="q" defaultValue={q ?? ""} placeholder={t.buscar} className="flex-1" />
        <Select name="species" defaultValue={species ?? ""} aria-label={t.filtros.especie}>
          <option value="">{t.filtros.todas}</option>
          {PET_SPECIES.map((sp) => (
            <option key={sp} value={sp}>
              {etiquetasEspecie[sp]}
            </option>
          ))}
        </Select>
        <Select name="sex" defaultValue={sex ?? ""} aria-label={t.filtros.sexo}>
          <option value="">{t.filtros.todos}</option>
          {PET_SEXES.map((sx) => (
            <option key={sx} value={sx}>
              {etiquetasSexo[sx]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          {mensajes.comun.buscar}
        </Button>
      </form>

      {filas.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-ink-muted">{t.vacio}</CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnas.mascota}</TableHead>
              <TableHead>{t.columnas.especie}</TableHead>
              <TableHead>{t.columnas.sexo}</TableHead>
              <TableHead>{t.columnas.edad}</TableHead>
              <TableHead>{t.columnas.principal}</TableHead>
              <TableHead>{t.columnas.numero}</TableHead>
              <TableHead>{t.columnas.alertas}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow key={fila.relacion.id}>
                <TableCell className="font-medium">
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/mascotas/${fila.mascota.id}`}
                  >
                    {fila.mascota.name}
                  </Link>
                  {fila.mascota.breed ? (
                    <p className="text-xs text-ink-muted">{fila.mascota.breed}</p>
                  ) : null}
                </TableCell>
                <TableCell>{etiquetasEspecie[fila.mascota.species]}</TableCell>
                <TableCell>{etiquetasSexo[fila.mascota.sex]}</TableCell>
                <TableCell>
                  {calcularEdad(fila.mascota.birth_date, fila.mascota.approximate_birth_date) ??
                    "—"}
                </TableCell>
                <TableCell>{fila.principal ? nombrePropietario(fila.principal) : "—"}</TableCell>
                <TableCell>{fila.relacion.internal_patient_number ?? "—"}</TableCell>
                <TableCell>
                  {fila.alertasActivas > 0 ? (
                    <Badge variant="warning">{fila.alertasActivas}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPaginas > 1 ? (
        <nav aria-label="Paginación" className="flex items-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              className="text-brand-700 hover:underline"
              href={`/app/mascotas?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              {mensajes.comun.paginaAnterior}
            </Link>
          ) : null}
          <span className="text-ink-muted">{mensajes.comun.paginaDe(page, totalPaginas)}</span>
          {page < totalPaginas ? (
            <Link
              className="text-brand-700 hover:underline"
              href={`/app/mascotas?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              {mensajes.comun.paginaSiguiente}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
