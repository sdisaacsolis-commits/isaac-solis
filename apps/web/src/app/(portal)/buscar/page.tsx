import { SERVICE_CATEGORIES } from "@dogtoralia/types";
import { Button, Select } from "@dogtoralia/ui";
import { publicSearchSchema } from "@dogtoralia/validation";
import type { Metadata } from "next";
import Link from "next/link";

import { BuscadorPublico } from "@/components/portal/buscador-publico";
import { ClinicaCard } from "@/components/portal/clinica-card";
import { mensajes } from "@/lib/i18n/es-mx";
import { buscarClinicasPublicas, listarCiudadesPublicas } from "@/lib/portal/public";

const t = mensajes.portalPublico.buscar;
const POR_PAGINA = 12;

export const metadata: Metadata = {
  title: mensajes.portalPublico.meta.tituloBuscar,
  description: mensajes.portalPublico.meta.descripcionBuscar,
};

export default async function PaginaBuscar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ciudad?: string; categoria?: string; page?: string }>;
}) {
  const params = await searchParams;
  const parsed = publicSearchSchema.safeParse(params);
  // Parámetros inválidos (p. ej. categoría inexistente) degradan a la búsqueda vacía.
  const filtros = parsed.success ? parsed.data : publicSearchSchema.parse({});
  const pagina = filtros.page;

  const [ciudades, resultados] = await Promise.all([
    listarCiudadesPublicas(),
    buscarClinicasPublicas({
      q: filtros.q,
      ciudad: filtros.ciudad,
      categoria: filtros.categoria,
      // Se pide una fila extra para saber si existe página siguiente.
      limit: POR_PAGINA + 1,
      offset: (pagina - 1) * POR_PAGINA,
    }),
  ]);
  const haySiguiente = resultados.length > POR_PAGINA;
  const visibles = resultados.slice(0, POR_PAGINA);

  const enlacePagina = (destino: number) => {
    const query = new URLSearchParams();
    if (filtros.q) query.set("q", filtros.q);
    if (filtros.ciudad) query.set("ciudad", filtros.ciudad);
    if (filtros.categoria) query.set("categoria", filtros.categoria);
    if (destino > 1) query.set("page", String(destino));
    const qs = query.toString();
    return qs ? `/buscar?${qs}` : "/buscar";
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>

      <BuscadorPublico
        ciudades={ciudades}
        defaultQ={filtros.q ?? ""}
        defaultCiudad={filtros.ciudad ?? ""}
        defaultCategoria={filtros.categoria}
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        {filtros.q ? <input type="hidden" name="q" value={filtros.q} /> : null}
        {filtros.ciudad ? <input type="hidden" name="ciudad" value={filtros.ciudad} /> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtro-categoria" className="text-sm font-medium text-ink">
            {t.filtroCategoria}
          </label>
          <Select id="filtro-categoria" name="categoria" defaultValue={filtros.categoria ?? ""}>
            <option value="">{t.todasLasCategorias}</option>
            {SERVICE_CATEGORIES.map((categoria) => (
              <option key={categoria} value={categoria}>
                {mensajes.servicios.categorias[categoria] ?? categoria}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          {mensajes.agenda.filtrar}
        </Button>
      </form>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted px-4 py-6 text-ink-muted">
          {t.vacio}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibles.map((clinica) => (
            <ClinicaCard key={clinica.slug} clinica={clinica} />
          ))}
        </div>
      )}

      {pagina > 1 || haySiguiente ? (
        <nav aria-label={t.titulo} className="flex items-center justify-between">
          {pagina > 1 ? (
            <Button asChild variant="outline">
              <Link href={enlacePagina(pagina - 1)}>{mensajes.comun.paginaAnterior}</Link>
            </Button>
          ) : (
            <span />
          )}
          {haySiguiente ? (
            <Button asChild variant="outline">
              <Link href={enlacePagina(pagina + 1)}>{mensajes.comun.paginaSiguiente}</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
