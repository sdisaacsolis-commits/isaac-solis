import { SERVICE_CATEGORIES } from "@dogtoralia/types";
import { Button, Card, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { BuscadorPublico } from "@/components/portal/buscador-publico";
import { mensajes } from "@/lib/i18n/es-mx";
import { listarCiudadesPublicas, slugificarCiudad } from "@/lib/portal/public";

const { marca, inicio, portalPublico, servicios } = mensajes;
const t = portalPublico.portada;

export const metadata: Metadata = {
  title: { absolute: portalPublico.meta.tituloPortada },
  description: portalPublico.meta.descripcionPortada,
};

export default async function PaginaInicio() {
  const ciudades = await listarCiudadesPublicas();

  return (
    <>
      <section className="border-b border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-5xl px-6 pb-14 pt-16 sm:pt-20">
          <p className="mx-auto mb-4 w-fit rounded-full bg-brand-100 px-4 py-1 text-sm font-medium text-brand-800">
            {inicio.etiquetaHero}
          </p>
          <h1 className="mx-auto max-w-3xl text-center text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {marca.eslogan}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-ink-muted">
            {t.tituloBuscador}
          </p>
          <div className="mx-auto mt-8 max-w-3xl">
            <BuscadorPublico ciudades={ciudades} />
          </div>
        </div>
      </section>

      <section aria-label={t.categorias} className="mx-auto w-full max-w-5xl px-6 py-12">
        <h2 className="mb-4 text-xl font-semibold text-ink">{t.categorias}</h2>
        <div className="flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map((categoria) => (
            <Link
              key={categoria}
              href={`/buscar?categoria=${categoria}`}
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {servicios.categorias[categoria] ?? categoria}
            </Link>
          ))}
        </div>
      </section>

      {ciudades.length > 0 ? (
        <section aria-label={t.ciudades} className="mx-auto w-full max-w-5xl px-6 pb-12">
          <h2 className="mb-4 text-xl font-semibold text-ink">{t.ciudades}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {ciudades.slice(0, 9).map((ciudad) => (
              <Link
                key={ciudad.city}
                href={`/veterinarios/${slugificarCiudad(ciudad.city)}`}
                className="rounded-lg border border-border bg-surface px-4 py-3 hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="font-medium text-ink">{ciudad.city}</p>
                <p className="text-sm text-ink-muted">{t.clinicasEn(ciudad.clinics)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label={t.propuestaTitulo} className="border-t border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-5xl px-6 py-12">
          <h2 className="mb-6 text-xl font-semibold text-ink">{t.propuestaTitulo}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.propuesta.map((bloque) => (
              <Card key={bloque.titulo}>
                <CardHeader>
                  <CardTitle className="text-base">{bloque.titulo}</CardTitle>
                  <CardDescription>{bloque.descripcion}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section aria-label={t.bannerProTitulo} className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="flex flex-col items-start gap-4 rounded-xl bg-brand-700 px-8 py-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t.bannerProTitulo}</h2>
            <p className="mt-1 max-w-xl text-sm text-brand-100">{t.bannerProTexto}</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/registro">{t.bannerProBoton}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
