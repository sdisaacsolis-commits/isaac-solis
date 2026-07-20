import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora } from "@/lib/agenda/dates";
import { obtenerConsulta } from "@/lib/clinica/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie, etiquetasSexo } from "@/lib/pets/format";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { BotonImprimir } from "./boton-imprimir";

export const metadata: Metadata = { title: mensajes.consultas.imprimir.documentoClinico };

const t = mensajes.consultas;
const p = mensajes.consultas.imprimir;

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-1 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * Documento clínico imprimible: SOLO consultas finalizadas (si no, regresa al
 * detalle). No incluye notas internas. La bitácora de impresión se registra al
 * hacer clic en «Imprimir» (log_clinical_record_access).
 */
export default async function PaginaImprimirConsulta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [context, { id }] = await Promise.all([requireTenancyContext(), params]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!context.activeClinic) redirect("/app/consultas");

  const detalle = await obtenerConsulta(id);
  if (!detalle) notFound();
  if (detalle.consulta.status !== "finalized") redirect(`/app/consultas/${id}`);

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
    adendas,
  } = detalle;

  const supabase = await createClient();
  const [{ data: clinica }, { data: autores }] = await Promise.all([
    supabase
      .from("clinics")
      .select(
        "name, phone, email, address_line_1, neighborhood, city, state, postal_code, timezone",
      )
      .eq("id", consulta.clinic_id)
      .maybeSingle(),
    adendas.length > 0
      ? supabase
          .from("colleague_profiles")
          .select("id, display_name, first_name, last_name")
          .in("id", [...new Set(adendas.map((a) => a.created_by).filter(Boolean))] as string[])
      : Promise.resolve({ data: [] }),
  ]);
  const tz = clinica?.timezone ?? context.activeClinic.timezone;
  const direccion = [
    clinica?.address_line_1,
    clinica?.neighborhood,
    clinica?.city,
    clinica?.state,
    clinica?.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const nombreAutor = (userId: string | null): string => {
    const autor = (autores ?? []).find((a) => a.id === userId);
    return (
      autor?.display_name ?? [autor?.first_name, autor?.last_name].filter(Boolean).join(" ") ?? "—"
    );
  };
  const ultimaMedicion = vitales[0] ?? null;

  const filasVitales = (medicion: (typeof vitales)[number]) =>
    (
      [
        [t.detalle.vitalPeso, medicion.weight_kg],
        [t.detalle.vitalTemperatura, medicion.temperature_c],
        [t.detalle.vitalFrecuenciaCardiaca, medicion.heart_rate_bpm],
        [t.detalle.vitalFrecuenciaRespiratoria, medicion.respiratory_rate_bpm],
        [t.detalle.vitalLlenadoCapilar, medicion.capillary_refill_seconds],
        [t.detalle.vitalCondicionCorporal, medicion.body_condition_score],
        [t.detalle.vitalDolor, medicion.pain_score],
        [t.detalle.vitalHidratacion, medicion.hydration_status],
        [t.detalle.vitalMucosas, medicion.mucous_membranes],
        [t.detalle.vitalPresionSistolica, medicion.blood_pressure_systolic],
        [t.detalle.vitalPresionDiastolica, medicion.blood_pressure_diastolic],
      ] as const
    ).filter(([, valor]) => valor !== null && valor !== undefined && valor !== "");

  return (
    <div className="mx-auto max-w-3xl bg-white p-4 text-sm text-gray-900 print:p-0">
      {/* En el papel solo existe el documento: sin navegación del panel. */}
      <style>{`@media print { body { background: #fff } header, nav { display: none !important } main { padding: 0 !important; max-width: 100% !important } }`}</style>

      <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
        <a
          className="text-sm text-brand-700 hover:underline"
          href={`/app/consultas/${consulta.id}`}
        >
          ← {t.detalle.titulo} {consulta.folio}
        </a>
        <BotonImprimir encounterId={consulta.id} />
      </div>

      <header className="mb-4 border-b-2 border-gray-800 pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">{mensajes.marca.nombre}</h1>
          <p className="text-xs uppercase tracking-widest text-gray-600">{p.documentoClinico}</p>
        </div>
        <p className="font-medium">{clinica?.name ?? "—"}</p>
        <p className="text-xs text-gray-600">
          {clinica?.phone ? `${p.telefono}: ${clinica.phone} · ` : ""}
          {clinica?.email ? `${p.correo}: ${clinica.email} · ` : ""}
          {direccion ? `${p.direccion}: ${direccion}` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div>
            <dt className="text-xs text-gray-600">{p.folio}</dt>
            <dd className="font-semibold">{consulta.folio}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">{p.veterinario}</dt>
            <dd>{veterinario ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">{p.inicio}</dt>
            <dd>{formatearFechaHora(consulta.started_at, tz)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">{p.finalizada}</dt>
            <dd>{consulta.finalized_at ? formatearFechaHora(consulta.finalized_at, tz) : "—"}</dd>
          </div>
        </dl>

        <Seccion titulo={p.paciente}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <dt className="text-xs text-gray-600">{p.paciente}</dt>
              <dd className="font-medium">{mascota?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{p.propietario}</dt>
              <dd>{propietario?.display_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{p.especie}</dt>
              <dd>
                {mascota ? etiquetasEspecie[mascota.species] : "—"}
                {mascota?.breed ? ` · ${p.raza}: ${mascota.breed}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{p.sexo}</dt>
              <dd>{mascota ? etiquetasSexo[mascota.sex] : "—"}</dd>
            </div>
          </dl>
        </Seccion>

        <Seccion titulo={p.motivo}>
          <p className="whitespace-pre-line">{consulta.chief_complaint ?? "—"}</p>
        </Seccion>

        <Seccion titulo={p.vitales}>
          {vitales.length === 0 ? (
            <p className="text-gray-600">
              {consulta.vitals_skipped_reason ?? t.detalle.sinVitales}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {ultimaMedicion ? (
                <p>
                  <span className="text-xs text-gray-600">{p.ultimaMedicion}: </span>
                  {filasVitales(ultimaMedicion)
                    .map(([etiqueta, valor]) => `${etiqueta}: ${valor}`)
                    .join(" · ")}
                </p>
              ) : null}
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-400 text-left">
                    <th className="py-1 pr-2 font-semibold">{t.detalle.columnaRegistrada}</th>
                    <th className="py-1 font-semibold">{t.detalle.columnaMedicion}</th>
                  </tr>
                </thead>
                <tbody>
                  {vitales.map((medicion) => (
                    <tr key={medicion.id} className="border-b border-gray-200 align-top">
                      <td className="whitespace-nowrap py-1 pr-2">
                        {formatearFechaHora(medicion.recorded_at, tz)}
                      </td>
                      <td className="py-1">
                        {filasVitales(medicion)
                          .map(([etiqueta, valor]) => `${etiqueta}: ${valor}`)
                          .join(" · ") || "—"}
                        {medicion.notes ? ` · ${medicion.notes}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Seccion>

        <Seccion titulo={p.exploracion}>
          {exploracion ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
              {(
                [
                  [t.detalle.expEstadoGeneral, exploracion.general_condition],
                  [t.detalle.expActitud, exploracion.attitude],
                  [t.detalle.expCondicionCorporal, exploracion.body_condition],
                  [t.detalle.expPielYPelaje, exploracion.skin_and_coat],
                  [t.detalle.expOjos, exploracion.eyes],
                  [t.detalle.expOidos, exploracion.ears],
                  [t.detalle.expCavidadOral, exploracion.oral_cavity],
                  [t.detalle.expCardiovascular, exploracion.cardiovascular],
                  [t.detalle.expRespiratorio, exploracion.respiratory],
                  [t.detalle.expDigestivo, exploracion.digestive],
                  [t.detalle.expUrinario, exploracion.urinary],
                  [t.detalle.expMusculoesqueletico, exploracion.musculoskeletal],
                  [t.detalle.expNeurologico, exploracion.neurological],
                  [t.detalle.expGanglios, exploracion.lymph_nodes],
                  [t.detalle.expObservaciones, exploracion.observations],
                ] as const
              ).map(([etiqueta, valor]) =>
                valor ? (
                  <div key={etiqueta}>
                    <dt className="text-xs text-gray-600">{etiqueta}</dt>
                    <dd className="whitespace-pre-line">{valor}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          ) : (
            <p className="text-gray-600">
              {consulta.examination_skipped_reason ?? mensajes.comun.sinDatos}
            </p>
          )}
        </Seccion>

        <Seccion titulo={p.nota}>
          {nota ? (
            <dl className="flex flex-col gap-1">
              {(
                [
                  [t.detalle.antecedentes, nota.history_summary],
                  [t.detalle.subjetivo, nota.subjective],
                  [t.detalle.objetivo, nota.objective],
                  [t.detalle.evaluacion, nota.assessment],
                  [t.detalle.plan, nota.plan],
                ] as const
              ).map(([etiqueta, valor]) =>
                valor ? (
                  <div key={etiqueta}>
                    <dt className="text-xs text-gray-600">{etiqueta}</dt>
                    <dd className="whitespace-pre-line">{valor}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          ) : (
            <p className="text-gray-600">{mensajes.comun.sinDatos}</p>
          )}
        </Seccion>

        <Seccion titulo={p.diagnosticos}>
          {diagnosticos.length === 0 ? (
            <p className="text-gray-600">{t.detalle.sinDiagnosticos}</p>
          ) : (
            <ul className="list-inside list-disc">
              {diagnosticos.map((diagnostico) => (
                <li key={diagnostico.id}>
                  {diagnostico.name} ({t.certezas[diagnostico.certainty] ?? diagnostico.certainty}
                  {diagnostico.is_primary ? ` · ${t.detalle.principal.toLowerCase()}` : ""})
                  {diagnostico.description ? ` — ${diagnostico.description}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        <Seccion titulo={p.tratamientos}>
          {tratamientos.length === 0 ? (
            <p className="text-gray-600">{t.detalle.sinTratamientos}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {tratamientos.map((tratamiento) => (
                <li key={tratamiento.id}>
                  <span className="font-medium">{tratamiento.name}</span> (
                  {t.tiposTratamiento[tratamiento.treatment_type] ?? tratamiento.treatment_type})
                  {[
                    tratamiento.instructions,
                    tratamiento.dosage_text,
                    tratamiento.route_text,
                    tratamiento.frequency_text,
                    tratamiento.duration_text,
                  ].filter(Boolean).length > 0
                    ? ` — ${[
                        tratamiento.instructions,
                        tratamiento.dosage_text,
                        tratamiento.route_text,
                        tratamiento.frequency_text,
                        tratamiento.duration_text,
                      ]
                        .filter(Boolean)
                        .join(" · ")}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        {seguimientos.length > 0 ? (
          <Seccion titulo={p.seguimientos}>
            <ul className="list-inside list-disc">
              {seguimientos.map((seguimiento) => (
                <li key={seguimiento.id}>
                  {seguimiento.reason}
                  {seguimiento.recommended_within_days
                    ? ` — ${t.detalle.enDias(seguimiento.recommended_within_days)}`
                    : ""}
                </li>
              ))}
            </ul>
          </Seccion>
        ) : null}

        {adendas.length > 0 ? (
          <Seccion titulo={p.adendas}>
            <ul className="flex flex-col gap-2">
              {adendas.map((adenda) => (
                <li key={adenda.id}>
                  <p className="text-xs text-gray-600">
                    {t.detalle.adendaPor} {nombreAutor(adenda.created_by)} ·{" "}
                    {formatearFechaHora(adenda.created_at, tz)} — {adenda.reason}
                  </p>
                  <p className="whitespace-pre-line">{adenda.content}</p>
                </li>
              ))}
            </ul>
          </Seccion>
        ) : null}

        <footer className="mt-2 border-t border-gray-300 pt-2 text-xs text-gray-600">
          {p.documentoClinico} · {mensajes.marca.nombre} · {p.finalizada}:{" "}
          {consulta.finalized_at ? formatearFechaHora(consulta.finalized_at, tz) : "—"}
        </footer>
      </div>
    </div>
  );
}
