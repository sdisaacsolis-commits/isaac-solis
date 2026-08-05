import { SERVICE_CATEGORIES } from "@dogtoralia/types";
import { Button } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { BuscadorPublico } from "@/components/portal/buscador-publico";
import { mensajes } from "@/lib/i18n/es-mx";
import { listarCiudadesPublicas, slugificarCiudad } from "@/lib/portal/public";
import { datosOrganizacionYSitio, JsonLd } from "@/lib/seo/jsonld";

const { portalPublico, servicios } = mensajes;
const t = portalPublico.portada;

export const metadata: Metadata = {
  title: { absolute: portalPublico.meta.tituloPortada },
  description: portalPublico.meta.descripcionPortada,
  alternates: { canonical: "/" },
  openGraph: {
    title: portalPublico.meta.tituloPortada,
    description: portalPublico.meta.descripcionPortada,
    url: "/",
  },
};

/** Íconos de línea por categoría de servicio (SVG en línea, heredan currentColor). */
function iconoServicio(categoria: string): ReactNode {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    "aria-hidden": true,
    className: "h-6 w-6",
  } as const;
  switch (categoria) {
    case "vaccination":
      return (
        <svg {...props}>
          <path
            d="m14 4 6 6M17 7 8.5 15.5a3 3 0 0 1-1.3.8L4 17l.7-3.2a3 3 0 0 1 .8-1.3L14 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="m9 9 3 3" strokeLinecap="round" />
        </svg>
      );
    case "surgery":
      return (
        <svg {...props}>
          <path
            d="M4 4c4 1 7 4 10 10l3 3-2 2-3-3C6 13 3 10 2 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
      );
    case "grooming":
      return (
        <svg {...props}>
          <circle cx="7" cy="7" r="3" />
          <circle cx="7" cy="17" r="3" />
          <path d="M9.5 9 20 19M9.5 15 20 5" strokeLinecap="round" />
        </svg>
      );
    case "laboratory":
      return (
        <svg {...props}>
          <path
            d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "imaging":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 4v16" strokeLinecap="round" />
        </svg>
      );
    case "dental":
      return (
        <svg {...props}>
          <path
            d="M12 5c-2-2-6-2-7 1s1 8 3 10c1 1 2-1 4-1s3 2 4 1c2-2 4-7 3-10s-5-3-7-1Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "emergency":
      return (
        <svg {...props}>
          <path d="M4 12h4l2-5 4 10 2-5h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      // consultation / other: estetoscopio
      return (
        <svg {...props}>
          <path d="M6 3v6a4 4 0 0 0 8 0V3" strokeLinecap="round" />
          <path d="M10 13v3a5 5 0 0 0 10 0v-2" strokeLinecap="round" />
          <circle cx="20" cy="12" r="2" />
        </svg>
      );
  }
}

function Palomita({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      aria-hidden="true"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CATEGORIAS_DESTACADAS = SERVICE_CATEGORIES.filter((c) => c !== "other");

export default async function PaginaInicio() {
  const ciudades = await listarCiudadesPublicas();
  const totalClinicas = ciudades.reduce((acc, ciudad) => acc + (ciudad.clinics ?? 0), 0);
  const mostrarMetricas = totalClinicas > 0;

  return (
    <>
      <JsonLd data={datosOrganizacionYSitio()} />
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[36rem]"
          style={{
            background:
              "radial-gradient(46% 55% at 82% 0%, color-mix(in oklch, var(--color-accent-400) 42%, transparent), transparent 70%)," +
              "radial-gradient(50% 60% at 8% 0%, color-mix(in oklch, var(--color-brand-300) 38%, transparent), transparent 66%)," +
              "radial-gradient(62% 72% at 50% -15%, var(--color-brand-100), transparent 72%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-800">
            <span aria-hidden="true">🇲🇽</span> {t.heroEtiqueta}
          </p>
          <h1 className="mt-5 max-w-[16ch] text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-6xl">
            {t.heroTituloInicio}{" "}
            <span className="italic text-brand-600">{t.heroTituloEnfasis}</span>
            {t.heroTituloFin}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-muted">{t.heroSubtitulo}</p>

          <div className="mt-8 max-w-3xl">
            <BuscadorPublico ciudades={ciudades} />
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
            <span className="text-brand-600">
              <Palomita />
            </span>
            {t.heroNota}
          </p>

          {mostrarMetricas ? (
            <div className="mt-10 flex flex-wrap items-baseline gap-x-8 gap-y-3">
              <p className="text-lg text-ink">
                <span className="text-2xl font-extrabold tracking-tight text-brand-700 [font-variant-numeric:tabular-nums]">
                  {totalClinicas}
                </span>{" "}
                <span className="text-ink-muted">{t.metricaClinicas(totalClinicas)}</span>{" "}
                <span className="text-ink-muted">{t.metricaCiudades(ciudades.length)}</span>
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ============================ CONFIANZA ============================ */}
      <section aria-label={t.opinionesEtiqueta} className="border-b border-border bg-surface-muted">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-6 px-6 py-6 md:grid-cols-4">
          {t.confianza.map((item) => (
            <div key={item.titulo} className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Palomita className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{item.titulo}</span>
                <span className="block text-xs text-ink-muted">{item.texto}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ CÓMO FUNCIONA ============================ */}
      <section aria-labelledby="como-title" className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
          {t.pasosEtiqueta}
        </p>
        <h2
          id="como-title"
          className="mt-3 max-w-[20ch] text-3xl font-bold tracking-tight text-ink sm:text-4xl"
        >
          {t.pasosTitulo}
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-ink-muted">{t.pasosSubtitulo}</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {t.pasos.map((paso, i) => (
            <li
              key={paso.titulo}
              className="rounded-card border border-border bg-surface p-6 shadow-sm"
            >
              <span className="text-3xl font-semibold italic text-brand-600 [font-variant-numeric:tabular-nums]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-xl font-semibold text-ink">{paso.titulo}</h3>
              <p className="mt-2 text-sm text-ink-muted">{paso.descripcion}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ============================ SERVICIOS ============================ */}
      <section aria-labelledby="svc-title" className="border-y border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
            {t.categorias}
          </p>
          <h2
            id="svc-title"
            className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            {t.serviciosTitulo}
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIAS_DESTACADAS.map((categoria, i) => (
              <Link
                key={categoria}
                href={`/buscar?categoria=${categoria}`}
                className="group flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                    i % 4 === 1 || i % 4 === 2
                      ? "bg-accent-400/25 text-accent-600"
                      : "bg-brand-100 text-brand-700"
                  }`}
                >
                  {iconoServicio(categoria)}
                </span>
                <span className="font-semibold text-ink">
                  {servicios.categorias[categoria] ?? categoria}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ CIUDADES ============================ */}
      {ciudades.length > 0 ? (
        <section aria-labelledby="cities-title" className="mx-auto w-full max-w-6xl px-6 py-20">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Cerca de ti</p>
          <h2
            id="cities-title"
            className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            {t.ciudades}
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {ciudades.slice(0, 9).map((ciudad) => (
              <Link
                key={ciudad.city}
                href={`/veterinarios/${slugificarCiudad(ciudad.city)}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4 transition hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>
                  <span className="block font-semibold text-ink">{ciudad.city}</span>
                  <span className="block text-sm text-ink-muted">
                    {t.clinicasEn(ciudad.clinics)}
                  </span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                  className="h-5 w-5 text-brand-600"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ============================ OPINIONES VERIFICADAS ============================ */}
      <section aria-labelledby="rev-title" className="border-y border-border bg-surface-muted">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
              {t.opinionesEtiqueta}
            </p>
            <h2
              id="rev-title"
              className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            >
              {t.opinionesTitulo}
            </h2>
            <p className="mt-4 max-w-xl text-lg text-ink-muted">{t.opinionesTexto}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {t.opinionesPuntos.map((punto) => (
                <li
                  key={punto}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1.5 text-sm font-medium text-brand-800"
                >
                  <Palomita className="h-4 w-4" /> {punto}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-border bg-surface p-8 shadow-md">
            <div className="flex gap-1 text-accent-500" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9L12 16.9 6.8 19.3l1-5.9L3.5 9.2l5.9-.9L12 3Z" />
                </svg>
              ))}
            </div>
            <p className="mt-4 text-2xl font-medium italic leading-snug tracking-tight text-ink">
              “Solo las personas que asistieron a una cita pueden opinar.”
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-800">
              <Palomita className="h-4 w-4" /> {t.opinionesEtiqueta}
            </p>
          </div>
        </div>
      </section>

      {/* ============================ DOBLE AUDIENCIA ============================ */}
      <section aria-labelledby="aud-title" className="mx-auto w-full max-w-6xl px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-wider text-accent-600">
          {t.audienciaEtiqueta}
        </p>
        <h2 id="aud-title" className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t.audienciaTitulo}
        </h2>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Dueños */}
          <div className="rounded-card border border-border bg-surface p-8 shadow-sm">
            <h3 className="text-2xl font-bold tracking-tight text-ink">{t.duenosTitulo}</h3>
            <p className="mt-3 text-ink-muted">{t.duenosTexto}</p>
            <ul className="mt-6 flex flex-col gap-4">
              {t.duenosPuntos.map((punto) => (
                <li key={punto.titulo} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md bg-brand-100 text-brand-700">
                    <Palomita />
                  </span>
                  <span>
                    <span className="font-semibold text-ink">{punto.titulo}</span>
                    <span className="block text-sm text-ink-muted">{punto.texto}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/buscar">{t.duenosCta}</Link>
              </Button>
            </div>
          </div>

          {/* Clínicas */}
          <div className="rounded-card border border-border bg-surface p-8 shadow-sm">
            <h3 className="text-2xl font-bold tracking-tight text-ink">{t.clinicasTitulo}</h3>
            <p className="mt-3 text-ink-muted">{t.clinicasTexto}</p>
            <ul className="mt-6 flex flex-col gap-4">
              {t.clinicasPuntos.map((punto) => (
                <li key={punto.titulo} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md bg-accent-400/25 text-accent-600">
                    <Palomita />
                  </span>
                  <span>
                    <span className="font-semibold text-ink">{punto.titulo}</span>
                    <span className="block text-sm text-ink-muted">{punto.texto}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button asChild size="lg" variant="secondary">
                <Link href="/registro">{t.clinicasCta}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ CTA FINAL ============================ */}
      <section aria-labelledby="cta-title" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-card bg-brand-700 px-8 py-12 text-white sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 120% at 90% 8%, color-mix(in oklch, var(--color-accent-500) 34%, transparent), transparent 60%)",
            }}
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="cta-title"
                className="max-w-[18ch] text-2xl font-bold tracking-tight sm:text-3xl"
              >
                {t.ctaTitulo}
              </h2>
              <p className="mt-2 max-w-md text-brand-100">{t.ctaTexto}</p>
            </div>
            <div className="flex flex-none flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/registro">{t.ctaBotonPro}</Link>
              </Button>
              <Button asChild size="lg" className="bg-accent-500 text-ink hover:bg-accent-400">
                <Link href="/buscar">{t.ctaBotonBuscar}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
