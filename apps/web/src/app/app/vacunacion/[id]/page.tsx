import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora, formatearFechaLarga } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie } from "@/lib/pets/format";
import { requireTenancyContext } from "@/lib/tenancy/queries";
import { descargarComprobanteHistorico } from "@/lib/vacunacion/actions";
import { varianteEstadoVacunacion, varianteFuenteVacunacion } from "@/lib/vacunacion/presentacion";
import { obtenerVacunacion } from "@/lib/vacunacion/queries";

import { AnularVacunacionForm } from "./vacunacion-detalle-forms";

export const metadata: Metadata = { title: mensajes.vacunacion.detalle.titulo };

const t = mensajes.vacunacion;
const d = mensajes.vacunacion.detalle;

export default async function PaginaDetalleVacunacion({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ comprobante?: string }>;
}) {
  const [context, { id }, query] = await Promise.all([
    requireTenancyContext(),
    params,
    searchParams,
  ]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }

  const detalle = await obtenerVacunacion(id);
  if (!detalle) notFound();
  const { registro, documento, historial, mascota, veterinario, clinica } = detalle;
  const tz = clinica?.timezone ?? context.activeClinic.timezone;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {query.comprobante === "error" ? (
        <Alert variant="destructive">{t.errores.comprobanteNoDescargable}</Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {d.titulo} — {registro.vaccine_name_snapshot}
        </h1>
        <Badge variant={varianteFuenteVacunacion(registro.source)}>
          {t.fuentes[registro.source] ?? registro.source}
        </Badge>
        <Badge variant={varianteEstadoVacunacion(registro.status)}>
          {t.estados[registro.status] ?? registro.status}
        </Badge>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/vacunacion/${registro.id}/imprimir`}>{d.verComprobante}</Link>
        </Button>
      </div>

      {registro.status === "voided" ? (
        <Alert variant="destructive">
          {d.anulada}
          {registro.voided_at ? ` (${formatearFechaHora(registro.voided_at, tz)})` : ""}
          {registro.void_reason ? ` — ${registro.void_reason}` : ""}
        </Alert>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-muted">{d.mascota}</dt>
              <dd className="font-medium text-ink">
                {mascota ? (
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/mascotas/${mascota.id}/vacunacion`}
                  >
                    {mascota.name}
                  </Link>
                ) : (
                  "—"
                )}
                {mascota ? (
                  <span className="text-ink-muted"> · {etiquetasEspecie[mascota.species]}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.aplicadaEl}</dt>
              <dd className="font-medium text-ink">
                {formatearFechaHora(registro.administered_at, tz)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.clinica}</dt>
              <dd className="font-medium text-ink">{clinica?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.veterinario}</dt>
              <dd className="font-medium text-ink">{veterinario ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.fabricante}</dt>
              <dd className="font-medium text-ink">{registro.manufacturer_snapshot ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.enfermedades}</dt>
              <dd className="font-medium text-ink">
                {registro.diseases_snapshot.length > 0
                  ? registro.diseases_snapshot.join(", ")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.lote}</dt>
              <dd className="font-medium text-ink">{registro.lot_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.caducidad}</dt>
              <dd className="font-medium text-ink">{registro.expiration_date ?? "—"}</dd>
            </div>
            {registro.lot_missing_reason ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.sinLote}</dt>
                <dd className="font-medium text-ink">{registro.lot_missing_reason}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-ink-muted">{d.proximaDosis}</dt>
              <dd className="font-medium text-ink">
                {registro.next_due_at ? formatearFechaLarga(registro.next_due_at, tz) : "—"}
              </dd>
            </div>
            {registro.route_text ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.via}</dt>
                <dd className="font-medium text-ink">{registro.route_text}</dd>
              </div>
            ) : null}
            {registro.application_site ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.sitio}</dt>
                <dd className="font-medium text-ink">{registro.application_site}</dd>
              </div>
            ) : null}
            {registro.dose_text ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.dosis}</dt>
                <dd className="font-medium text-ink">{registro.dose_text}</dd>
              </div>
            ) : null}
            {registro.historical_provider_name ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.proveedorExterno}</dt>
                <dd className="font-medium text-ink">{registro.historical_provider_name}</dd>
              </div>
            ) : null}
            {registro.historical_document_reference ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.referenciaDocumento}</dt>
                <dd className="font-medium text-ink">{registro.historical_document_reference}</dd>
              </div>
            ) : null}
          </dl>
          {registro.notes ? (
            <p className="mt-3 text-sm text-ink">
              <span className="text-ink-muted">{d.notas}: </span>
              {registro.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {registro.historical_document_path ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.comprobanteHistorico}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={descargarComprobanteHistorico}>
              <input type="hidden" name="recordId" value={registro.id} />
              <Button type="submit" variant="outline" size="sm">
                {d.descargar}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {documento ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.documento}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="break-all text-ink-muted">
              {d.verificacion}: sha256:{documento.sha256}
            </p>
            <div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/vacunacion/${registro.id}/imprimir`}>{d.verComprobante}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {historial.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.historial}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2">
              {historial.map((evento) => (
                <li key={evento.id} className="text-sm text-ink">
                  <span className="text-ink-muted">
                    {formatearFechaHora(evento.created_at, tz)} ·{" "}
                  </span>
                  {evento.from_status ? `${t.estados[evento.from_status]} → ` : ""}
                  <strong>{t.estados[evento.to_status] ?? evento.to_status}</strong>
                  {evento.reason ? ` — ${evento.reason}` : ""}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {registro.status === "recorded" ? (
        <Card>
          <CardContent className="pt-6">
            <AnularVacunacionForm recordId={registro.id} petId={registro.pet_id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
