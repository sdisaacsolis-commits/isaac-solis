import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { formatearPrecioMXN } from "@/lib/agenda/dates";
import { listarPlanesPublicos } from "@/lib/facturacion/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { datosBreadcrumbs, datosFaq, JsonLd } from "@/lib/seo/jsonld";

const t = mensajes.portalPublico.precios;

export const metadata: Metadata = {
  title: t.metaTitulo,
  description: t.metaDescripcion,
  alternates: { canonical: "/precios" },
  openGraph: { title: t.metaTitulo, description: t.metaDescripcion, url: "/precios" },
};

// El catálogo cambia poco: se revalida cada hora (igual que el sitemap).
export const revalidate = 3600;

/** Página pública de precios: catálogo activo desde la RPC curada. */
export default async function PaginaPrecios() {
  const planes = await listarPlanesPublicos();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12 sm:px-6">
      <JsonLd
        data={[
          datosBreadcrumbs([
            { nombre: mensajes.portalPublico.directorios.inicio, ruta: "/" },
            { nombre: t.metaTitulo },
          ]),
          datosFaq(t.faq.map(({ pregunta, respuesta }) => ({ pregunta, respuesta }))),
        ]}
      />

      <header className="flex flex-col items-center gap-4 text-center">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t.heroTitulo}
        </h1>
        <p className="max-w-2xl text-ink-muted">{t.heroTexto}</p>
        <Badge variant="brand">{t.prueba}</Badge>
      </header>

      <section aria-label={t.metaTitulo} className="grid gap-6 sm:grid-cols-2">
        {planes.map((plan) => (
          <Card key={plan.code} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>
                {t.porClinica} · {t.incluido}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <p className="text-ink">
                <span className="text-3xl font-bold tracking-tight">
                  {formatearPrecioMXN(plan.priceCents)}
                </span>{" "}
                <span className="text-ink-muted">
                  {plan.billingInterval === "month" ? t.porMes : t.porAnio} {t.masIva}
                </span>
              </p>
              {plan.billingInterval === "year" ? (
                <Badge variant="success" className="w-fit">
                  {t.ahorroAnual}
                </Badge>
              ) : null}
              {plan.additionalVeterinarianPriceCents !== null ? (
                <p className="text-sm text-ink-muted">
                  {plan.billingInterval === "month"
                    ? t.vetAdicionalMes(formatearPrecioMXN(plan.additionalVeterinarianPriceCents))
                    : t.vetAdicionalAnio(formatearPrecioMXN(plan.additionalVeterinarianPriceCents))}
                </p>
              ) : null}
              <ul className="flex flex-col gap-1 text-sm text-ink-muted">
                {t.incluye.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden="true" className="text-brand-700">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                <Button asChild size="lg" className="w-full">
                  <Link href="/registro">{t.ctaBoton}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <p className="mx-auto max-w-2xl text-center text-sm text-ink-muted">{t.comparativa}</p>

      <section aria-label={t.faqTitulo} className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <h2 className="text-xl font-semibold text-ink">{t.faqTitulo}</h2>
        {t.faq.map(({ pregunta, respuesta }) => (
          <details key={pregunta} className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer font-medium text-ink">{pregunta}</summary>
            <p className="mt-2 text-sm text-ink-muted">{respuesta}</p>
          </details>
        ))}
      </section>

      <section className="flex flex-col items-center gap-4 rounded-2xl bg-brand-600 px-6 py-10 text-center">
        <h2 className="text-2xl font-bold text-white">{t.ctaTitulo}</h2>
        <p className="max-w-xl text-brand-100">{t.ctaTexto}</p>
        <Button asChild size="lg" variant="secondary">
          <Link href="/registro">{t.ctaBoton}</Link>
        </Button>
      </section>
    </div>
  );
}
