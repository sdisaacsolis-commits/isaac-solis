import type { ServiceCategory } from "@dogtoralia/types";
import { SERVICE_CATEGORIES } from "@dogtoralia/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClinicaCard } from "@/components/portal/clinica-card";
import { mensajes } from "@/lib/i18n/es-mx";
import {
  buscarClinicasPublicas,
  listarCiudadesPublicas,
  resolverCiudadPublica,
  slugificarCiudad,
} from "@/lib/portal/public";
import { datosBreadcrumbs, JsonLd } from "@/lib/seo/jsonld";

const t = mensajes.portalPublico;

/** Directorio SEO programático "{Categoría} en {Ciudad}" (paridad Doctoralia). */
interface Params {
  params: Promise<{ categoria: string; ciudad: string }>;
}

function categoriaValida(valor: string): ServiceCategory | null {
  return (SERVICE_CATEGORIES as readonly string[]).includes(valor)
    ? (valor as ServiceCategory)
    : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { categoria, ciudad } = await params;
  const cat = categoriaValida(categoria);
  const ciudadPublica = cat ? await resolverCiudadPublica(ciudad) : null;
  if (!cat || !ciudadPublica) return { title: mensajes.meta.tituloPorDefecto };
  const titulo = t.meta.tituloServicioEn(
    mensajes.servicios.categorias[cat] ?? cat,
    ciudadPublica.city,
  );
  const descripcion = t.meta.descripcionDirectorio(titulo);
  const ruta = `/servicios/${cat}/${slugificarCiudad(ciudadPublica.city)}`;
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: { title: titulo, description: descripcion, url: ruta },
  };
}

export default async function PaginaServicioCiudad({ params }: Params) {
  const { categoria, ciudad } = await params;
  const cat = categoriaValida(categoria);
  if (!cat) notFound();
  const ciudadPublica = await resolverCiudadPublica(ciudad);
  if (!ciudadPublica) notFound();

  const etiquetaCategoria = mensajes.servicios.categorias[cat] ?? cat;
  const [clinicas, ciudades] = await Promise.all([
    buscarClinicasPublicas({ ciudad: ciudadPublica.city, categoria: cat, limit: 50 }),
    listarCiudadesPublicas(),
  ]);
  const otrasCiudades = ciudades.filter((c) => c.city !== ciudadPublica.city);
  const otrasCategorias = SERVICE_CATEGORIES.filter((c) => c !== cat);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <JsonLd
        data={datosBreadcrumbs([
          { nombre: t.directorios.inicio, ruta: "/" },
          { nombre: etiquetaCategoria, ruta: `/buscar?categoria=${cat}` },
          { nombre: ciudadPublica.city },
        ])}
      />
      <nav
        aria-label={t.directorios.servicioEn(etiquetaCategoria, ciudadPublica.city)}
        className="text-sm text-ink-muted"
      >
        <Link className="hover:underline" href="/">
          {t.directorios.inicio}
        </Link>{" "}
        /{" "}
        <Link className="hover:underline" href={`/buscar?categoria=${cat}`}>
          {etiquetaCategoria}
        </Link>{" "}
        / <span className="text-ink">{ciudadPublica.city}</span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight text-ink">
        {t.directorios.servicioEn(etiquetaCategoria, ciudadPublica.city)}
      </h1>

      {clinicas.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted px-4 py-6 text-ink-muted">
          {t.directorios.sinClinicas}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {clinicas.map((clinica) => (
            <ClinicaCard key={clinica.slug} clinica={clinica} />
          ))}
        </div>
      )}

      <section aria-label={t.directorios.serviciosEnCiudad(ciudadPublica.city)}>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          {t.directorios.serviciosEnCiudad(ciudadPublica.city)}
        </h2>
        <div className="flex flex-wrap gap-2">
          {otrasCategorias.map((otra) => (
            <Link
              key={otra}
              href={`/servicios/${otra}/${slugificarCiudad(ciudadPublica.city)}`}
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand-300 hover:bg-brand-50"
            >
              {mensajes.servicios.categorias[otra] ?? otra}
            </Link>
          ))}
        </div>
      </section>

      {otrasCiudades.length > 0 ? (
        <section aria-label={t.directorios.otrasCiudades}>
          <h2 className="mb-3 text-lg font-semibold text-ink">{t.directorios.otrasCiudades}</h2>
          <div className="flex flex-wrap gap-2">
            {otrasCiudades.map((otra) => (
              <Link
                key={otra.city}
                href={`/servicios/${cat}/${slugificarCiudad(otra.city)}`}
                className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand-300 hover:bg-brand-50"
              >
                {otra.city}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
