import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { RatingStars } from "@/components/portal/rating-stars";
import { formatearFecha } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetaEstadoResena, varianteEstadoResena } from "@/lib/resenas/presentacion";
import { listarResenasDeClinica } from "@/lib/resenas/queries";
import { puedeAdministrarOrganizacion } from "@/lib/roles";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { AccionesResena } from "./resena-acciones";

const t = mensajes.resenas.panel;

export const metadata: Metadata = { title: t.titulo };

export default async function PaginaOpinionesPanel() {
  const context = await requireTenancyContext();
  const clinica = context.activeClinic;
  const puedeModerar = puedeAdministrarOrganizacion(context.membership.role);
  const resenas = clinica ? await listarResenasDeClinica(clinica.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="mt-1 text-ink-muted">{t.descripcion}</p>
      </div>

      {!clinica ? (
        <Alert variant="info">{mensajes.panel.sinClinica}</Alert>
      ) : resenas.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted px-4 py-6 text-ink-muted">
          {t.vacio}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {resenas.map((resena) => (
            <Card key={resena.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{resena.author}</CardTitle>
                  <div className="flex items-center gap-2">
                    {resena.reportedAt ? <Badge variant="warning">{t.yaReportada}</Badge> : null}
                    <Badge variant={varianteEstadoResena(resena.status)}>
                      {etiquetaEstadoResena(resena.status)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars value={resena.rating} size="sm" />
                  <span className="text-sm text-ink-muted">
                    {formatearFecha(resena.created_at)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {resena.title ? <p className="font-semibold text-ink">{resena.title}</p> : null}
                <p className="whitespace-pre-line text-ink">{resena.body}</p>
                {resena.veterinarian ? (
                  <p className="text-ink-muted">{t.atendioPor(resena.veterinarian)}</p>
                ) : null}
                {resena.reportReason ? (
                  <p className="text-ink-muted">
                    {t.motivoReporte}: <span className="text-ink">{resena.reportReason}</span>
                  </p>
                ) : null}
                {resena.clinicReply ? (
                  <div className="rounded-lg border-l-4 border-brand-400 bg-brand-50 px-4 py-3">
                    <p className="font-semibold text-brand-800">{t.tuRespuesta}</p>
                    <p className="whitespace-pre-line text-ink">{resena.clinicReply}</p>
                  </div>
                ) : null}
                <AccionesResena
                  reviewId={resena.id}
                  status={resena.status}
                  reportada={resena.reportedAt !== null}
                  puedeModerar={puedeModerar}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
