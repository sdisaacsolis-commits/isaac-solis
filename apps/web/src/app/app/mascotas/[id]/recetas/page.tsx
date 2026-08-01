import {
  Badge,
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
import { mensajes } from "@/lib/i18n/es-mx";
import { varianteEstadoReceta } from "@/lib/recetas/presentacion";
import { recetasDeMascota, TAMANO_PAGINA_RECETAS } from "@/lib/recetas/queries";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.recetas.mascota.titulo };

const t = mensajes.recetas;
const m = mensajes.recetas.mascota;

export default async function PaginaRecetasMascota({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
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

  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const { filas, total } = await recetasDeMascota({
    petId: mascota.id,
    clinicId: clinica.id,
    page,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_RECETAS));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          className="text-sm text-brand-700 hover:underline"
          href={`/app/mascotas/${mascota.id}`}
        >
          {m.volverAMascota}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
          {m.titulo} — {mascota.name}
        </h1>
        <p className="text-sm text-ink-muted">{m.descripcion}</p>
      </div>

      {filas.length === 0 ? (
        <p className="text-ink-muted">{m.sinRecetas}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnaFolio}</TableHead>
              <TableHead>{t.columnaFecha}</TableHead>
              <TableHead>{t.columnaVeterinario}</TableHead>
              <TableHead>{t.columnaVigencia}</TableHead>
              <TableHead>{t.columnaEstado}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map(({ receta, veterinario }) => (
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
        <nav aria-label={m.titulo} className="flex items-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              className="text-brand-700 hover:underline"
              href={`/app/mascotas/${mascota.id}/recetas?page=${page - 1}`}
            >
              {mensajes.comun.paginaAnterior}
            </Link>
          ) : null}
          <span className="text-ink-muted">{mensajes.comun.paginaDe(page, totalPaginas)}</span>
          {page < totalPaginas ? (
            <Link
              className="text-brand-700 hover:underline"
              href={`/app/mascotas/${mascota.id}/recetas?page=${page + 1}`}
            >
              {mensajes.comun.paginaSiguiente}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
