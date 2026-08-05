import "server-only";

import { env } from "@/env";
import { mensajes } from "@/lib/i18n/es-mx";
import type { ClinicaPublica, VeterinarioPublico } from "@/lib/portal/public";

/**
 * Datos estructurados Schema.org (JSON-LD) del sitio público.
 *
 * Los objetos se construyen SOLO con datos ya expuestos por las RPCs públicas
 * curadas (nunca datos internos), y los campos ausentes se omiten en lugar de
 * inventarse: Google penaliza el markup que no coincide con el contenido visible.
 */

type JsonLdObject = Record<string, unknown>;

function absoluta(ruta: string): string {
  return new URL(ruta, env.NEXT_PUBLIC_APP_URL).toString();
}

/** Elimina claves con valor null/undefined/"" para emitir markup limpio. */
function compacto(objeto: JsonLdObject): JsonLdObject {
  return Object.fromEntries(
    Object.entries(objeto).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  );
}

/**
 * Script `application/ld+json`. Los bloques de datos no se ejecutan como JS,
 * pero se escapa `<` para impedir cierres de etiqueta inyectados en contenido.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll("<", "\\u003c") }}
    />
  );
}

/** Organización + sitio con búsqueda interna (portada). */
export function datosOrganizacionYSitio(): JsonLdObject[] {
  const base = env.NEXT_PUBLIC_APP_URL;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: mensajes.marca.nombre,
      url: base,
      description: mensajes.meta.descripcion,
      logo: absoluta("/opengraph-image"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: mensajes.marca.nombre,
      url: base,
      inLanguage: "es-MX",
      potentialAction: {
        "@type": "SearchAction",
        target: `${base}/buscar?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/** Ficha de clínica: VeterinaryCare con dirección, servicios y rating real. */
export function datosClinica(clinica: ClinicaPublica): JsonLdObject {
  const direccion = compacto({
    "@type": "PostalAddress",
    streetAddress:
      [clinica.address_line_1, clinica.address_line_2].filter(Boolean).join(", ") || null,
    addressLocality: clinica.city,
    addressRegion: clinica.state,
    postalCode: clinica.postal_code,
    addressCountry: "MX",
  });

  const rating =
    clinica.rating.count > 0 && clinica.rating.average !== null
      ? {
          "@type": "AggregateRating",
          ratingValue: clinica.rating.average,
          reviewCount: clinica.rating.count,
          bestRating: 5,
          worstRating: 1,
        }
      : null;

  return compacto({
    "@context": "https://schema.org",
    "@type": "VeterinaryCare",
    name: clinica.name,
    url: absoluta(`/clinicas/${encodeURIComponent(clinica.slug)}`),
    description: clinica.description,
    telephone: clinica.phone,
    email: clinica.email,
    address: Object.keys(direccion).length > 1 ? direccion : null,
    aggregateRating: rating,
    makesOffer:
      clinica.services.length > 0
        ? clinica.services.map((servicio) =>
            compacto({
              "@type": "Offer",
              name: servicio.name,
              description: servicio.description,
              price: (servicio.price_cents / 100).toFixed(2),
              priceCurrency: "MXN",
            }),
          )
        : null,
  });
}

/** Perfil público de veterinario: Person vinculada a sus clínicas. */
export function datosVeterinario(veterinario: VeterinarioPublico): JsonLdObject {
  return compacto({
    "@context": "https://schema.org",
    "@type": "Person",
    name: veterinario.display_name ?? veterinario.slug,
    url: absoluta(`/veterinarios/${encodeURIComponent(veterinario.slug)}`),
    jobTitle: mensajes.portalPublico.seo.puestoVeterinario,
    description: veterinario.headline,
    worksFor:
      veterinario.clinics.length > 0
        ? veterinario.clinics.map((clinica) =>
            compacto({
              "@type": "VeterinaryCare",
              name: clinica.clinic_name,
              url: absoluta(`/clinicas/${encodeURIComponent(clinica.clinic_slug)}`),
              address: clinica.city
                ? compacto({
                    "@type": "PostalAddress",
                    addressLocality: clinica.city,
                    addressRegion: clinica.state,
                    addressCountry: "MX",
                  })
                : null,
            }),
          )
        : null,
  });
}

/** Migas de pan de los directorios: cada item con nombre y URL absoluta. */
export function datosBreadcrumbs(items: Array<{ nombre: string; ruta?: string }>): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) =>
      compacto({
        "@type": "ListItem",
        position: i + 1,
        name: item.nombre,
        item: item.ruta ? absoluta(item.ruta) : null,
      }),
    ),
  };
}
