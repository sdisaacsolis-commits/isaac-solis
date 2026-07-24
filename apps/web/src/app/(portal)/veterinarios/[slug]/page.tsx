import { SERVICE_CATEGORIES } from "@dogtoralia/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClinicaCard } from "@/components/portal/clinica-card";
import { mensajes } from "@/lib/i18n/es-mx";
import {
  buscarClinicasPublicas,
  listarCiudadesPublicas,
  obtenerVeterinarioPublico,
  resolverCiudadPublica,
  slugificarCiudad,
} from "@/lib/portal/public";

const t = mensajes.portalPublico;

/**
 * Ruta doble (paridad Doctoralia): `/veterinarios/[slug]` es el perfil público
 * de un veterinario cuando el slug existe, o el directorio SEO
 * "Veterinarios en {Ciudad}" cuando el segmento corresponde a una ciudad.
 */
interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const veterinario = await obtenerVeterinarioPublico(slug);
  if (veterinario) {
    return {
      title: t.meta.tituloVeterinario(veterinario.display_name ?? veterinario.slug),
      description:
        veterinario.headline ??
        t.meta.descripcionDirectorio(
          t.meta.tituloVeterinario(veterinario.display_name ?? veterinario.slug),
        ),
    };
  }
  const ciudad = await resolverCiudadPublica(slug);
  if (ciudad) {
    return {
      title: t.meta.tituloVeterinariosEn(ciudad.city),
      description: t.meta.descripcionDirectorio(t.meta.tituloVeterinariosEn(ciudad.city)),
    };
  }
  return { title: mensajes.meta.tituloPorDefecto };
}

export default async function PaginaVeterinarioOCiudad({ params }: Params) {
  const { slug } = await params;

  const veterinario = await obtenerVeterinarioPublico(slug);
  if (veterinario) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            {veterinario.display_name ?? veterinario.slug}
          </h1>
          {veterinario.headline ? (
            <p className="text-lg text-ink-muted">{veterinario.headline}</p>
          ) : null}
        </div>
        {veterinario.bio ? (
          <p className="max-w-3xl whitespace-pre-line text-ink">{veterinario.bio}</p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.veterinario.atiendeEn}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {veterinario.clinics.length === 0 ? (
              <p className="text-sm text-ink-muted">{t.veterinario.sinClinicas}</p>
            ) : (
              veterinario.clinics.map((clinica) => (
                <div
                  key={clinica.clinic_member_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <Link
                      className="font-medium text-brand-700 hover:underline"
                      href={`/clinicas/${encodeURIComponent(clinica.clinic_slug)}`}
                    >
                      {clinica.clinic_name}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      {[clinica.city, clinica.state].filter(Boolean).join(", ")}
                    </p>
                    {clinica.professional_license ? (
                      <p className="text-sm text-ink-muted">
                        {t.clinica.cedula(clinica.professional_license)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {clinica.accepts_online_booking ? (
                      <>
                        <Badge variant="brand">{t.buscar.badgeReservacion}</Badge>
                        <Button asChild size="sm">
                          <Link
                            href={`/clinicas/${encodeURIComponent(clinica.clinic_slug)}#reservar`}
                          >
                            {t.veterinario.reservar}
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/clinicas/${encodeURIComponent(clinica.clinic_slug)}`}>
                          {t.veterinario.verClinica}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Directorio SEO por ciudad.
  const ciudad = await resolverCiudadPublica(slug);
  if (!ciudad) notFound();

  const [clinicas, ciudades] = await Promise.all([
    buscarClinicasPublicas({ ciudad: ciudad.city, limit: 50 }),
    listarCiudadesPublicas(),
  ]);
  const otrasCiudades = ciudades.filter((c) => c.city !== ciudad.city);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <nav aria-label={t.directorios.breadcrumbVeterinarios} className="text-sm text-ink-muted">
        <Link className="hover:underline" href="/">
          {t.directorios.inicio}
        </Link>{" "}
        /{" "}
        <Link className="hover:underline" href="/buscar">
          {t.directorios.breadcrumbVeterinarios}
        </Link>{" "}
        / <span className="text-ink">{ciudad.city}</span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight text-ink">
        {t.directorios.veterinariosEn(ciudad.city)}
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

      <section aria-label={t.directorios.serviciosEnCiudad(ciudad.city)}>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          {t.directorios.serviciosEnCiudad(ciudad.city)}
        </h2>
        <div className="flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map((categoria) => (
            <Link
              key={categoria}
              href={`/servicios/${categoria}/${slugificarCiudad(ciudad.city)}`}
              className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand-300 hover:bg-brand-50"
            >
              {mensajes.servicios.categorias[categoria] ?? categoria}
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
                href={`/veterinarios/${slugificarCiudad(otra.city)}`}
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
