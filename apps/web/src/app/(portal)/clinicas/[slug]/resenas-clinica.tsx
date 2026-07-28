import { Button, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import Link from "next/link";

import { RatingStars } from "@/components/portal/rating-stars";
import { formatearFecha } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import type { ResenasDeClinica } from "@/lib/portal/public";

const t = mensajes.resenas;

interface Props {
  slug: string;
  datos: ResenasDeClinica;
  /** Página actual (1-based) para la paginación "ver más". */
  pagina: number;
  porPagina: number;
}

/**
 * Sección "Opiniones" del perfil público de la clínica: cabecera con promedio y
 * total, lista de reseñas curadas (autor enmascarado, veterinario, fecha es-MX)
 * y la respuesta de la clínica en un bloque diferenciado. Paginación por enlace.
 */
export function ResenasClinica({ slug, datos, pagina, porPagina }: Props) {
  const { rating, reviews } = datos;
  const hayMas = reviews.length >= porPagina && rating.count > pagina * porPagina;

  return (
    <Card id="opiniones">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{t.publico.titulo}</CardTitle>
          <RatingStars value={rating.average} count={rating.count} showCount />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {reviews.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface-muted px-4 py-6 text-ink-muted">
            {t.publico.vacio}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {reviews.map((resena, indice) => (
              <li
                key={`${resena.created_at}-${indice}`}
                className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <RatingStars value={resena.rating} size="sm" />
                  <span className="text-sm text-ink-muted">
                    {formatearFecha(resena.created_at)}
                  </span>
                </div>
                {resena.title ? <p className="font-semibold text-ink">{resena.title}</p> : null}
                <p className="whitespace-pre-line text-ink">{resena.body}</p>
                <p className="text-sm text-ink-muted">
                  {resena.author}
                  {resena.veterinarian ? ` · ${t.publico.atendioPor(resena.veterinarian)}` : ""}
                </p>
                {resena.clinic_reply ? (
                  <div className="mt-1 rounded-lg border-l-4 border-brand-400 bg-brand-50 px-4 py-3">
                    <p className="text-sm font-semibold text-brand-800">
                      {t.publico.respuestaClinica}
                    </p>
                    <p className="whitespace-pre-line text-sm text-ink">{resena.clinic_reply}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {pagina > 1 || hayMas ? (
          <nav aria-label={t.publico.titulo} className="flex items-center justify-between">
            {pagina > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/clinicas/${encodeURIComponent(slug)}?opiniones=${pagina - 1}#opiniones`}
                >
                  {mensajes.comun.paginaAnterior}
                </Link>
              </Button>
            ) : (
              <span />
            )}
            {hayMas ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/clinicas/${encodeURIComponent(slug)}?opiniones=${pagina + 1}#opiniones`}
                >
                  {t.publico.verMas}
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </CardContent>
    </Card>
  );
}
