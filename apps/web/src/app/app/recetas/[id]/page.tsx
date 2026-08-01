import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie } from "@/lib/pets/format";
import { eliminarPartida } from "@/lib/recetas/actions";
import { varianteEstadoReceta } from "@/lib/recetas/presentacion";
import { obtenerReceta } from "@/lib/recetas/queries";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import {
  AnularRecetaForm,
  DescartarBorradorForm,
  EmitirRecetaForm,
  EncabezadoRecetaForm,
  PartidaForm,
  SustituirRecetaForm,
} from "./receta-forms";

export const metadata: Metadata = { title: mensajes.recetas.detalle.titulo };

const t = mensajes.recetas;
const d = mensajes.recetas.detalle;

/** Línea compacta con el contenido clínico de una partida (texto del veterinario). */
function resumenPartida(partida: {
  dosage_text: string;
  route_text: string;
  frequency_text: string;
  duration_text: string;
  quantity_text: string | null;
  instructions: string | null;
}): string {
  return [
    `${d.dosis}: ${partida.dosage_text}`,
    `${d.via}: ${partida.route_text}`,
    `${d.frecuencia}: ${partida.frequency_text}`,
    `${d.duracion}: ${partida.duration_text}`,
    partida.quantity_text ? `${d.cantidad}: ${partida.quantity_text}` : "",
    partida.instructions ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function PaginaDetalleReceta({ params }: { params: Promise<{ id: string }> }) {
  const [context, { id }] = await Promise.all([requireTenancyContext(), params]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }

  const detalle = await obtenerReceta(id);
  if (!detalle) notFound();
  const {
    receta,
    partidas,
    historial,
    mascota,
    propietario,
    consulta,
    veterinario,
    folioSustituida,
    sustituta,
  } = detalle;
  const tz = context.activeClinic.timezone;
  const editable = receta.status === "draft";
  const posicionSugerida = partidas.reduce((max, p) => Math.max(max, p.position), 0) + 1;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {editable ? d.borrador : `${d.titulo} ${receta.folio ?? ""}`}
        </h1>
        <Badge variant={varianteEstadoReceta(receta.status)}>
          {t.estados[receta.status] ?? receta.status}
        </Badge>
        {!editable ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/recetas/${receta.id}/imprimir`}>{d.verImprimir}</Link>
          </Button>
        ) : null}
      </div>

      <Alert>{t.aviso}</Alert>

      {receta.status === "voided" ? (
        <Alert variant="destructive">
          {d.anulada}
          {receta.voided_at ? ` (${formatearFechaHora(receta.voided_at, tz)})` : ""}
          {receta.void_reason ? ` — ${receta.void_reason}` : ""}
        </Alert>
      ) : null}
      {receta.status === "superseded" && sustituta ? (
        <Alert variant="warning">
          {t.estados.superseded} — {d.sustituidaPor}{" "}
          <Link
            className="font-medium text-brand-700 hover:underline"
            href={`/app/recetas/${sustituta.id}`}
          >
            {sustituta.folio ?? t.borradorSinFolio}
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-muted">{d.paciente}</dt>
              <dd className="font-medium text-ink">
                {mascota ? (
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/mascotas/${mascota.id}`}
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
              <dt className="text-sm text-ink-muted">{d.propietario}</dt>
              <dd className="font-medium text-ink">{propietario?.display_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.veterinario}</dt>
              <dd className="font-medium text-ink">{veterinario ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.consulta}</dt>
              <dd className="font-medium text-ink">
                {consulta ? (
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/consultas/${consulta.id}`}
                  >
                    {consulta.folio}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            {receta.issued_at ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.emitidaEl}</dt>
                <dd className="font-medium text-ink">{formatearFechaHora(receta.issued_at, tz)}</dd>
              </div>
            ) : null}
            {receta.valid_until ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.vigenciaHasta}</dt>
                <dd className="font-medium text-ink">{receta.valid_until}</dd>
              </div>
            ) : null}
            {folioSustituida && receta.supersedes_prescription_id ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.sustituyeA}</dt>
                <dd className="font-medium text-ink">
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/recetas/${receta.supersedes_prescription_id}`}
                  >
                    {folioSustituida}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.encabezado}</CardTitle>
        </CardHeader>
        <CardContent>
          {editable ? (
            <EncabezadoRecetaForm receta={receta} />
          ) : (
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-ink-muted">{d.instruccionesGenerales}</dt>
                <dd className="whitespace-pre-line text-ink">
                  {receta.general_instructions ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">{d.indicacionClinica}</dt>
                <dd className="text-ink">{receta.clinical_indication ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{d.vigenciaHasta}</dt>
                <dd className="text-ink">{receta.valid_until ?? "—"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.partidas}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {partidas.length === 0 ? (
            <p className="text-sm text-ink-muted">{d.sinPartidas}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {partidas.map((partida) => (
                <li key={partida.id} className="rounded-lg border border-border px-4 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">
                      {partida.position}. {partida.medication_name}
                      {partida.concentration ? ` ${partida.concentration}` : ""}
                      {partida.as_needed ? (
                        <Badge className="ml-2" variant="neutral">
                          {d.prn}
                        </Badge>
                      ) : null}
                    </p>
                    {editable ? (
                      <form action={eliminarPartida}>
                        <input type="hidden" name="prescriptionId" value={receta.id} />
                        <input type="hidden" name="itemId" value={partida.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          {d.quitar}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                  <p className="text-sm text-ink-muted">{resumenPartida(partida)}</p>
                  {editable ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-brand-700">
                        {d.editarPartida}
                      </summary>
                      <div className="pt-3">
                        <PartidaForm prescriptionId={receta.id} partida={partida} />
                      </div>
                    </details>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {editable ? (
            <PartidaForm prescriptionId={receta.id} posicionSugerida={posicionSugerida} />
          ) : null}
        </CardContent>
      </Card>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.preview}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-ink-muted">{d.previewNota}</p>
            <div className="rounded-lg border border-border p-4">
              <p className="font-semibold text-ink">
                {mascota?.name ?? "—"} · {propietario?.display_name ?? "—"}
              </p>
              <p className="text-ink-muted">{veterinario ?? "—"}</p>
              <ol className="mt-2 list-inside list-decimal">
                {partidas.map((partida) => (
                  <li key={partida.id}>
                    <span className="font-medium">{partida.medication_name}</span> —{" "}
                    {resumenPartida(partida)}
                  </li>
                ))}
              </ol>
              {receta.general_instructions ? (
                <p className="mt-2 whitespace-pre-line">{receta.general_instructions}</p>
              ) : null}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.emision}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {editable ? (
            <>
              <Alert>{d.requisitosEmitir}</Alert>
              <EmitirRecetaForm prescriptionId={receta.id} />
              <DescartarBorradorForm prescriptionId={receta.id} />
            </>
          ) : null}
          {receta.status === "issued" ? (
            <>
              <Alert variant="success">{d.inmutable}</Alert>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/app/recetas/${receta.id}/imprimir`}>
                    {t.imprimir.imprimirBoton}
                  </Link>
                </Button>
              </div>
              {!receta.superseded_by_prescription_id ? (
                <SustituirRecetaForm prescriptionId={receta.id} />
              ) : null}
              <AnularRecetaForm prescriptionId={receta.id} />
            </>
          ) : null}
          {receta.status === "superseded" ? <AnularRecetaForm prescriptionId={receta.id} /> : null}
          {receta.status === "voided" ? (
            <Alert variant="destructive">
              {d.anulada}
              {receta.void_reason ? ` — ${receta.void_reason}` : ""}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
