import { Button } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import {
  CLINIC_PAID_PLANS,
  CLINIC_PLAN_PATH,
  CLINIC_TRIAL,
  CLINIC_TRIAL_REGISTER_PATH,
  formatClinicPlanPrice,
} from "@/lib/clinic-plans/catalog";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.portalPublico.planes;

export const metadata: Metadata = {
  title: t.metaTitulo,
  description: t.metaDescripcion,
  alternates: { canonical: CLINIC_PLAN_PATH },
};

export default function PaginaPlanes() {
  return (
    <>
      <section className="border-b border-border bg-brand-50">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
              {t.etiqueta}
            </p>
            <h1 className="mt-4 max-w-[17ch] text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">
              {t.titulo}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
              {t.descripcion}
            </p>
          </div>
          <div className="rounded-card border border-brand-200 bg-surface p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-ink">{t.pruebaTitulo(CLINIC_TRIAL.days)}</h2>
            <p className="mt-3 text-4xl font-extrabold text-brand-700">
              {formatClinicPlanPrice(CLINIC_TRIAL.priceCents)}{" "}
              <span className="text-sm font-semibold text-ink-muted">{t.moneda}</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t.pruebaNota}</p>
            <Button asChild size="lg" className="mt-6 w-full min-h-12">
              <Link href={CLINIC_TRIAL_REGISTER_PATH}>{t.pruebaCta}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="planes-mensuales"
        className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 sm:py-16"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-brand-700">{t.lanzamiento}</p>
        <h2 id="planes-mensuales" className="mt-3 text-3xl font-bold tracking-tight text-ink">
          {t.mensualesTitulo}
        </h2>
        <p className="mt-3 max-w-2xl text-ink-muted">{t.mensualesNota}</p>
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CLINIC_PAID_PLANS.map((plan) => {
            const copy = t.niveles[plan.code];
            return (
              <li
                key={plan.code}
                className="flex flex-col rounded-card border border-border bg-surface p-6"
              >
                <h3 className="text-xl font-bold text-ink">{copy.titulo}</h3>
                <p className="mt-2 min-h-10 text-sm text-ink-muted">{copy.descripcion}</p>
                <p className="mt-4 text-3xl font-extrabold tracking-tight text-brand-700">
                  {formatClinicPlanPrice(plan.priceCents)}{" "}
                  <span className="text-sm font-semibold text-ink-muted">{t.porMes}</span>
                </p>
                <p className="mt-1 text-sm text-ink-muted">{t.iva}</p>
                <ul className="my-5 space-y-2 border-t border-border pt-4 text-sm text-ink">
                  <li>{t.sedes(plan.locations)}</li>
                  <li>{t.veterinarios(plan.veterinarians)}</li>
                </ul>
                <p className="mt-auto w-fit rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800">
                  {t.estadoPago}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="herramientas-clinica"
        className="border-y border-border bg-surface-muted"
      >
        <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 sm:py-16">
          <h2 id="herramientas-clinica" className="text-3xl font-bold tracking-tight text-ink">
            {t.herramientasTitulo}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.herramientas.map((herramienta) => (
              <li
                key={herramienta.titulo}
                className="rounded-card border border-border bg-surface p-5"
              >
                <h3 className="font-bold text-ink">{herramienta.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {herramienta.descripcion}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="como-iniciar-prueba"
        className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <div>
          <h2 id="como-iniciar-prueba" className="text-3xl font-bold tracking-tight text-ink">
            {t.pasosTitulo}
          </h2>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-ink-muted">
            {t.pasos.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
          <Button asChild size="lg" className="mt-6 min-h-12">
            <Link href={CLINIC_TRIAL_REGISTER_PATH}>{t.pruebaCta}</Link>
          </Button>
        </div>
        <div className="rounded-card border border-border p-6">
          <h2 className="text-xl font-bold tracking-tight text-ink">{t.preguntasTitulo}</h2>
          <ul className="mt-2 divide-y divide-border">
            {t.preguntas.map((pregunta) => (
              <li key={pregunta.titulo}>
                <details className="py-3">
                  <summary className="cursor-pointer rounded-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {pregunta.titulo}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {pregunta.respuesta}
                  </p>
                </details>
              </li>
            ))}
          </ul>
          <Link
            href="/buscar"
            className="mt-4 inline-block text-sm font-semibold text-brand-700 underline"
          >
            {t.buscar}
          </Link>
        </div>
      </section>
    </>
  );
}
