import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora } from "@/lib/agenda/dates";
import { listarServicios } from "@/lib/agenda/queries";
import {
  descargarArchivoClinico,
  quitarDiagnostico,
  quitarTratamiento,
} from "@/lib/clinica/actions";
import { varianteEstadoConsulta } from "@/lib/clinica/presentacion";
import { obtenerConsulta } from "@/lib/clinica/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie } from "@/lib/pets/format";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import {
  AdendaForm,
  AnularForm,
  ArchivoForm,
  CabeceraForm,
  DiagnosticoForm,
  ExploracionForm,
  FinalizarForm,
  NotaForm,
  SeguimientoForm,
  TratamientoForm,
  VitalesForm,
} from "./consulta-forms";

export const metadata: Metadata = { title: mensajes.consultas.detalle.titulo };

const t = mensajes.consultas;
const d = mensajes.consultas.detalle;

/** Etiquetas por medición para la tabla de vitales. */
const CAMPOS_VITALES = [
  ["weight_kg", d.vitalPeso],
  ["temperature_c", d.vitalTemperatura],
  ["heart_rate_bpm", d.vitalFrecuenciaCardiaca],
  ["respiratory_rate_bpm", d.vitalFrecuenciaRespiratoria],
  ["capillary_refill_seconds", d.vitalLlenadoCapilar],
  ["body_condition_score", d.vitalCondicionCorporal],
  ["pain_score", d.vitalDolor],
  ["blood_pressure_systolic", d.vitalPresionSistolica],
  ["blood_pressure_diastolic", d.vitalPresionDiastolica],
] as const;

export default async function PaginaDetalleConsulta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ archivo?: string }>;
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

  const detalle = await obtenerConsulta(id);
  if (!detalle) notFound();
  const {
    consulta,
    mascota,
    propietario,
    veterinario,
    nota,
    exploracion,
    vitales,
    diagnosticos,
    tratamientos,
    seguimientos,
    archivos,
    adendas,
    historial,
  } = detalle;
  const tz = context.activeClinic.timezone;
  const editable = consulta.status === "in_progress";

  // Recepción ve la cabecera, pero RLS le oculta el contenido clínico: se
  // muestra el aviso y se omiten las secciones (la BD es la autoridad; esto
  // es solo presentación).
  const miembro = context.clinicMemberships.find((m) => m.clinic_id === consulta.clinic_id);
  const contenidoRestringido = miembro?.role === "receptionist";

  const servicios = editable
    ? await listarServicios(consulta.clinic_id, { soloActivos: true })
    : [];
  const serviciosParaSeguimiento = servicios.map((s) => ({ id: s.id, nombre: s.name }));

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {query.archivo === "error" ? (
        <Alert variant="destructive">{t.errores.archivoNoDescargable}</Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {d.titulo} {consulta.folio}
        </h1>
        <Badge variant={varianteEstadoConsulta(consulta.status)}>
          {t.estados[consulta.status] ?? consulta.status}
        </Badge>
        {consulta.encounter_type === "emergency" ? (
          <Badge variant="destructive">{t.urgencia}</Badge>
        ) : null}
        {consulta.status === "finalized" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/consultas/${consulta.id}/imprimir`}>{d.verDocumento}</Link>
          </Button>
        ) : null}
      </div>

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
              <dd className="font-medium text-ink">
                {propietario ? (
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/propietarios/${propietario.id}`}
                  >
                    {propietario.display_name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.veterinario}</dt>
              <dd className="font-medium text-ink">{veterinario ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.tipo}</dt>
              <dd className="font-medium text-ink">
                {t.tipos[consulta.encounter_type] ?? consulta.encounter_type}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">{d.inicio}</dt>
              <dd className="font-medium text-ink">
                {formatearFechaHora(consulta.started_at, tz)}
              </dd>
            </div>
            {consulta.finalized_at ? (
              <div>
                <dt className="text-sm text-ink-muted">{d.finalizadaEl}</dt>
                <dd className="font-medium text-ink">
                  {formatearFechaHora(consulta.finalized_at, tz)}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {consulta.status === "voided" ? (
        <Alert variant="destructive">
          {d.anulada}
          {consulta.voided_at ? ` (${formatearFechaHora(consulta.voided_at, tz)})` : ""}
          {consulta.void_reason ? ` — ${consulta.void_reason}` : ""}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.motivoSeccion}</CardTitle>
        </CardHeader>
        <CardContent>
          {editable ? (
            <CabeceraForm encounterId={consulta.id} consulta={consulta} />
          ) : (
            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-ink-muted">{d.motivo}</dt>
                <dd className="whitespace-pre-line text-ink">{consulta.chief_complaint ?? "—"}</dd>
              </div>
              {consulta.vitals_skipped_reason ? (
                <div>
                  <dt className="text-ink-muted">{d.motivoOmitirVitales}</dt>
                  <dd className="text-ink">{consulta.vitals_skipped_reason}</dd>
                </div>
              ) : null}
              {consulta.examination_skipped_reason ? (
                <div>
                  <dt className="text-ink-muted">{d.motivoOmitirExploracion}</dt>
                  <dd className="text-ink">{consulta.examination_skipped_reason}</dd>
                </div>
              ) : null}
              {consulta.internal_notes ? (
                <div>
                  <dt className="text-ink-muted">{d.notasInternas}</dt>
                  <dd className="whitespace-pre-line text-ink">{consulta.internal_notes}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </CardContent>
      </Card>

      {contenidoRestringido ? (
        <Alert>{d.contenidoRestringido}</Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.antecedentesYSoap}</CardTitle>
            </CardHeader>
            <CardContent>
              {editable ? (
                <NotaForm encounterId={consulta.id} nota={nota} />
              ) : nota ? (
                <dl className="flex flex-col gap-3 text-sm">
                  {(
                    [
                      [d.antecedentes, nota.history_summary],
                      [d.subjetivo, nota.subjective],
                      [d.objetivo, nota.objective],
                      [d.evaluacion, nota.assessment],
                      [d.plan, nota.plan],
                    ] as const
                  ).map(([etiqueta, valor]) =>
                    valor ? (
                      <div key={etiqueta}>
                        <dt className="text-ink-muted">{etiqueta}</dt>
                        <dd className="whitespace-pre-line text-ink">{valor}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              ) : (
                <p className="text-sm text-ink-muted">{mensajes.comun.sinDatos}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.vitales}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {vitales.length === 0 ? (
                <p className="text-sm text-ink-muted">{d.sinVitales}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{d.columnaRegistrada}</TableHead>
                      <TableHead>{d.columnaMedicion}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vitales.map((medicion) => (
                      <TableRow key={medicion.id}>
                        <TableCell className="whitespace-nowrap align-top">
                          {formatearFechaHora(medicion.recorded_at, tz)}
                        </TableCell>
                        <TableCell>
                          {CAMPOS_VITALES.filter(([campo]) => medicion[campo] !== null)
                            .map(([campo, etiqueta]) => `${etiqueta}: ${medicion[campo]}`)
                            .join(" · ") || "—"}
                          {medicion.hydration_status
                            ? ` · ${d.vitalHidratacion}: ${medicion.hydration_status}`
                            : ""}
                          {medicion.mucous_membranes
                            ? ` · ${d.vitalMucosas}: ${medicion.mucous_membranes}`
                            : ""}
                          {medicion.notes ? ` · ${medicion.notes}` : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {editable ? <VitalesForm encounterId={consulta.id} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.exploracion}</CardTitle>
            </CardHeader>
            <CardContent>
              {editable ? (
                <ExploracionForm encounterId={consulta.id} exploracion={exploracion} />
              ) : exploracion ? (
                <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  {(
                    [
                      [d.expEstadoGeneral, exploracion.general_condition],
                      [d.expActitud, exploracion.attitude],
                      [d.expCondicionCorporal, exploracion.body_condition],
                      [d.expPielYPelaje, exploracion.skin_and_coat],
                      [d.expOjos, exploracion.eyes],
                      [d.expOidos, exploracion.ears],
                      [d.expCavidadOral, exploracion.oral_cavity],
                      [d.expCardiovascular, exploracion.cardiovascular],
                      [d.expRespiratorio, exploracion.respiratory],
                      [d.expDigestivo, exploracion.digestive],
                      [d.expUrinario, exploracion.urinary],
                      [d.expMusculoesqueletico, exploracion.musculoskeletal],
                      [d.expNeurologico, exploracion.neurological],
                      [d.expGanglios, exploracion.lymph_nodes],
                      [d.expObservaciones, exploracion.observations],
                    ] as const
                  ).map(([etiqueta, valor]) =>
                    valor ? (
                      <div key={etiqueta}>
                        <dt className="text-ink-muted">{etiqueta}</dt>
                        <dd className="whitespace-pre-line text-ink">{valor}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              ) : (
                <p className="text-sm text-ink-muted">{mensajes.comun.sinDatos}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.diagnosticos}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {diagnosticos.length === 0 ? (
                <p className="text-sm text-ink-muted">{d.sinDiagnosticos}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {diagnosticos.map((diagnostico) => (
                    <li
                      key={diagnostico.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
                    >
                      <div>
                        <p className="font-medium text-ink">
                          {diagnostico.name}{" "}
                          {diagnostico.is_primary ? (
                            <Badge variant="brand">{d.principal}</Badge>
                          ) : null}{" "}
                          <Badge variant="neutral">
                            {t.certezas[diagnostico.certainty] ?? diagnostico.certainty}
                          </Badge>
                        </p>
                        {diagnostico.description ? (
                          <p className="text-sm text-ink-muted">{diagnostico.description}</p>
                        ) : null}
                      </div>
                      {editable ? (
                        <form action={quitarDiagnostico}>
                          <input type="hidden" name="diagnosisId" value={diagnostico.id} />
                          <input type="hidden" name="encounterId" value={consulta.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {d.quitar}
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {editable ? <DiagnosticoForm encounterId={consulta.id} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.tratamientos}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {tratamientos.length === 0 ? (
                <p className="text-sm text-ink-muted">{d.sinTratamientos}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {tratamientos.map((tratamiento) => (
                    <li
                      key={tratamiento.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
                    >
                      <div>
                        <p className="font-medium text-ink">
                          {tratamiento.name}{" "}
                          <Badge variant="neutral">
                            {t.tiposTratamiento[tratamiento.treatment_type] ??
                              tratamiento.treatment_type}
                          </Badge>{" "}
                          {tratamiento.performed_during_encounter ? (
                            <Badge variant="success">{d.aplicadoEnConsulta}</Badge>
                          ) : null}
                        </p>
                        <p className="text-sm text-ink-muted">
                          {[
                            tratamiento.instructions,
                            tratamiento.dosage_text,
                            tratamiento.route_text,
                            tratamiento.frequency_text,
                            tratamiento.duration_text,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {editable ? (
                        <form action={quitarTratamiento}>
                          <input type="hidden" name="treatmentId" value={tratamiento.id} />
                          <input type="hidden" name="encounterId" value={consulta.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {d.quitar}
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {editable ? <TratamientoForm encounterId={consulta.id} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.seguimiento}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {seguimientos.length === 0 ? (
                <p className="text-sm text-ink-muted">{d.sinSeguimientos}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm text-ink">
                  {seguimientos.map((seguimiento) => (
                    <li key={seguimiento.id}>
                      {seguimiento.reason}
                      {seguimiento.recommended_within_days
                        ? ` — ${d.enDias(seguimiento.recommended_within_days)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
              {editable ? (
                <SeguimientoForm encounterId={consulta.id} servicios={serviciosParaSeguimiento} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d.archivos}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {archivos.length === 0 ? (
                <p className="text-sm text-ink-muted">{d.sinArchivos}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {archivos.map((archivo) => (
                    <li
                      key={archivo.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
                    >
                      <div>
                        <p className="font-medium text-ink">{archivo.original_filename}</p>
                        <p className="text-sm text-ink-muted">
                          {t.tiposArchivo[archivo.kind] ?? archivo.kind} ·{" "}
                          {formatearFechaHora(archivo.created_at, tz)}
                          {archivo.description ? ` · ${archivo.description}` : ""}
                        </p>
                      </div>
                      <form action={descargarArchivoClinico}>
                        <input type="hidden" name="fileId" value={archivo.id} />
                        <Button type="submit" variant="outline" size="sm">
                          {d.descargar}
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              {editable ? <ArchivoForm encounterId={consulta.id} /> : null}
            </CardContent>
          </Card>
        </>
      )}

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

      {!contenidoRestringido && (consulta.status === "finalized" || adendas.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{d.adendas}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {adendas.length === 0 ? (
              <p className="text-sm text-ink-muted">{d.sinAdendas}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {adendas.map((adenda) => (
                  <li key={adenda.id} className="rounded-lg border border-border px-4 py-2">
                    <p className="text-sm text-ink-muted">
                      {formatearFechaHora(adenda.created_at, tz)} — {adenda.reason}
                    </p>
                    <p className="whitespace-pre-line text-sm text-ink">{adenda.content}</p>
                  </li>
                ))}
              </ul>
            )}
            {consulta.status === "finalized" ? <AdendaForm encounterId={consulta.id} /> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.finalizacion}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {consulta.status === "in_progress" ? (
            <>
              <Alert>{d.requisitosFinalizar}</Alert>
              {!contenidoRestringido ? <FinalizarForm encounterId={consulta.id} /> : null}
              <AnularForm encounterId={consulta.id} />
            </>
          ) : null}
          {consulta.status === "finalized" ? (
            <>
              <Alert variant="success">{d.inmutable}</Alert>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/app/consultas/${consulta.id}/imprimir`}>{d.imprimir}</Link>
                </Button>
              </div>
              <AnularForm encounterId={consulta.id} />
            </>
          ) : null}
          {consulta.status === "voided" ? (
            <Alert variant="destructive">
              {d.anulada}
              {consulta.void_reason ? ` — ${consulta.void_reason}` : ""}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
