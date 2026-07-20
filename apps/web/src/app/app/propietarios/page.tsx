import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
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
import { nombrePropietario } from "@/lib/pets/format";
import { listarPropietarios, TAMANO_PAGINA } from "@/lib/pets/queries";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.pacientes.propietarios.titulo };

const t = mensajes.pacientes.propietarios;

function formatearFecha(valor: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City",
  }).format(new Date(valor));
}

export default async function PaginaPropietarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }

  const filtros = clinicSearchSchema.safeParse(params);
  const q = filtros.success ? filtros.data.q : undefined;
  const page = filtros.success ? filtros.data.page : 1;
  const { filas, total } = await listarPropietarios({
    clinicId: context.activeClinic.id,
    q,
    page,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <Button asChild>
          <Link href="/app/propietarios/nuevo">{t.nuevo}</Link>
        </Button>
      </div>

      <form method="get" className="flex max-w-lg gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          {t.buscar}
        </label>
        <Input id="q" name="q" defaultValue={q ?? ""} placeholder={t.buscar} />
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
              <TableHead>{t.columnas.nombre}</TableHead>
              <TableHead>{t.columnas.telefono}</TableHead>
              <TableHead>{t.columnas.correo}</TableHead>
              <TableHead>{t.columnas.mascotas}</TableHead>
              <TableHead>{t.columnas.registro}</TableHead>
              <TableHead>{t.columnas.estado}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow key={fila.relacion.id}>
                <TableCell className="font-medium">
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/propietarios/${fila.propietario.id}`}
                  >
                    {nombrePropietario(fila.propietario)}
                  </Link>
                </TableCell>
                <TableCell>{fila.propietario.phone ?? "—"}</TableCell>
                <TableCell>{fila.propietario.email ?? "—"}</TableCell>
                <TableCell>{fila.mascotasAccesibles}</TableCell>
                <TableCell>{formatearFecha(fila.relacion.created_at)}</TableCell>
                <TableCell>
                  <Badge variant="success">{mensajes.clinicas.activa}</Badge>
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
              href={`/app/propietarios?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              {mensajes.comun.paginaAnterior}
            </Link>
          ) : null}
          <span className="text-ink-muted">{mensajes.comun.paginaDe(page, totalPaginas)}</span>
          {page < totalPaginas ? (
            <Link
              className="text-brand-700 hover:underline"
              href={`/app/propietarios?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              {mensajes.comun.paginaSiguiente}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
