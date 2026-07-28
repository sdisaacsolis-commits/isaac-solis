import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import Link from "next/link";

import { RatingStars } from "@/components/portal/rating-stars";
import { formatearPrecioMXN } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import type { ClinicaPublicaResumen } from "@/lib/portal/public";

const t = mensajes.portalPublico.buscar;

/** Tarjeta de resultado del marketplace (búsqueda y directorios SEO). */
export function ClinicaCard({ clinica }: { clinica: ClinicaPublicaResumen }) {
  const ubicacion = [clinica.neighborhood, clinica.city, clinica.state].filter(Boolean).join(", ");
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">
            <Link
              className="text-brand-700 hover:underline"
              href={`/clinicas/${encodeURIComponent(clinica.slug)}`}
            >
              {clinica.name}
            </Link>
          </CardTitle>
          {clinica.accepts_online_booking ? (
            <Badge variant="brand">{t.badgeReservacion}</Badge>
          ) : null}
        </div>
        {ubicacion ? <CardDescription>{ubicacion}</CardDescription> : null}
        <RatingStars
          value={clinica.rating.average}
          count={clinica.rating.count}
          size="sm"
          showCount
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {clinica.description ? (
          <p className="text-sm text-ink-muted">{clinica.description}</p>
        ) : null}
        <p className="text-sm text-ink">
          {t.servicios(clinica.services_count)}
          {clinica.price_from_cents !== null
            ? ` · ${t.desde(formatearPrecioMXN(clinica.price_from_cents))}`
            : ""}
        </p>
      </CardContent>
    </Card>
  );
}
