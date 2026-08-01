import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { contenidoRecetaSchema } from "@/lib/recetas/documento";
import { obtenerReceta } from "@/lib/recetas/queries";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { BotonImprimirReceta } from "./boton-imprimir-receta";

export const metadata: Metadata = { title: mensajes.recetas.imprimir.documento };

const t = mensajes.recetas;
const p = mensajes.recetas.imprimir;

/**
 * Receta imprimible: renderiza EXCLUSIVAMENTE el snapshot congelado
 * (prescription_documents.content), jamás datos vivos. Un borrador no tiene
 * documento → redirige al detalle. Sin notas internas. La bitácora de
 * impresión se registra al hacer clic en «Imprimir» (log_prescription_access).
 */
export default async function PaginaImprimirReceta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [context, { id }] = await Promise.all([requireTenancyContext(), params]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!context.activeClinic) redirect("/app/recetas");

  const detalle = await obtenerReceta(id);
  if (!detalle) notFound();
  const { receta, documento, cedulaVeterinario, sustituta } = detalle;
  if (receta.status === "draft" || !documento) redirect(`/app/recetas/${id}`);

  const parsed = contenidoRecetaSchema.safeParse(documento.content);
  if (!parsed.success) redirect(`/app/recetas/${id}`);
  const contenido = parsed.data;

  const tz = contenido.clinic?.timezone ?? context.activeClinic.timezone;
  const direccion = [
    contenido.clinic?.address_line_1,
    contenido.clinic?.neighborhood,
    contenido.clinic?.city,
    contenido.clinic?.state,
    contenido.clinic?.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const items = [...(contenido.items ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const cedula = contenido.prescriber?.professional_license ?? cedulaVeterinario;

  // Banda visible cuando el documento dejó de estar vigente.
  const marca =
    receta.status === "voided"
      ? p.marcaAnulada
      : receta.status === "superseded"
        ? p.marcaSustituida(sustituta?.folio ?? "—")
        : null;

  return (
    <div className="mx-auto max-w-3xl bg-white p-4 text-sm text-gray-900 print:p-0">
      {/* En el papel solo existe el documento: sin navegación del panel. */}
      <style>{`@media print { body { background: #fff } header, nav { display: none !important } main { padding: 0 !important; max-width: 100% !important } }`}</style>

      <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
        <a className="text-sm text-brand-700 hover:underline" href={`/app/recetas/${receta.id}`}>
          ← {t.detalle.titulo} {receta.folio ?? ""}
        </a>
        <BotonImprimirReceta prescriptionId={receta.id} />
      </div>

      {marca ? (
        <div className="mb-4 border-4 border-red-700 py-2 text-center text-xl font-extrabold uppercase tracking-widest text-red-700">
          {marca}
        </div>
      ) : null}

      <header className="mb-4 border-b-2 border-gray-800 pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">{mensajes.marca.nombre}</h1>
          <p className="text-xs uppercase tracking-widest text-gray-600">{p.documento}</p>
        </div>
        <p className="font-medium">{contenido.clinic?.name ?? "—"}</p>
        <p className="text-xs text-gray-600">
          {contenido.clinic?.phone ? `${p.telefono}: ${contenido.clinic.phone} · ` : ""}
          {contenido.clinic?.email ? `${p.correo}: ${contenido.clinic.email} · ` : ""}
          {direccion ? `${p.direccion}: ${direccion}` : ""}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div>
            <dt className="text-xs text-gray-600">{p.folio}</dt>
            <dd className="font-semibold">{contenido.folio ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">{p.estado}</dt>
            <dd className="font-semibold">{t.estados[receta.status] ?? receta.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">{p.emitida}</dt>
            <dd>{contenido.issued_at ? formatearFechaHora(contenido.issued_at, tz) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">{p.vigencia}</dt>
            <dd>{contenido.valid_until ?? "—"}</dd>
          </div>
          {contenido.supersedes_folio ? (
            <div>
              <dt className="text-xs text-gray-600">{t.detalle.sustituyeA}</dt>
              <dd>{contenido.supersedes_folio}</dd>
            </div>
          ) : null}
        </dl>

        <section className="break-inside-avoid">
          <h2 className="mb-1 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
            {p.paciente}
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <dt className="text-xs text-gray-600">{p.paciente}</dt>
              <dd className="font-medium">{contenido.pet?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{p.propietario}</dt>
              <dd>{contenido.owner?.display_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{p.especie}</dt>
              <dd>
                {contenido.pet?.species ?? "—"}
                {contenido.pet?.breed ? ` · ${p.raza}: ${contenido.pet.breed}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{p.peso}</dt>
              <dd>{contenido.pet?.weight_kg ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="break-inside-avoid">
          <h2 className="mb-1 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
            {p.medicamentos}
          </h2>
          <ol className="flex flex-col gap-2">
            {items.map((item, indice) => (
              <li key={`${item.position ?? indice}-${item.medication_name ?? indice}`}>
                <p className="font-semibold">
                  {item.position ?? indice + 1}. {item.medication_name ?? "—"}
                  {item.concentration ? ` ${item.concentration}` : ""}
                  {item.presentation ? ` · ${item.presentation}` : ""}
                </p>
                <p>
                  {[
                    item.dosage_text ? `${t.detalle.dosis}: ${item.dosage_text}` : "",
                    item.route_text ? `${t.detalle.via}: ${item.route_text}` : "",
                    item.frequency_text ? `${t.detalle.frecuencia}: ${item.frequency_text}` : "",
                    item.duration_text ? `${t.detalle.duracion}: ${item.duration_text}` : "",
                    item.quantity_text ? `${t.detalle.cantidad}: ${item.quantity_text}` : "",
                    item.as_needed ? t.detalle.prn : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {item.instructions ? (
                  <p className="whitespace-pre-line text-gray-700">{item.instructions}</p>
                ) : null}
                {item.notes ? <p className="text-gray-700">{item.notes}</p> : null}
              </li>
            ))}
          </ol>
        </section>

        {contenido.general_instructions ? (
          <section className="break-inside-avoid">
            <h2 className="mb-1 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
              {p.instruccionesGenerales}
            </h2>
            <p className="whitespace-pre-line">{contenido.general_instructions}</p>
          </section>
        ) : null}

        {contenido.clinical_indication ? (
          <section className="break-inside-avoid">
            <h2 className="mb-1 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
              {p.indicacionClinica}
            </h2>
            <p className="whitespace-pre-line">{contenido.clinical_indication}</p>
          </section>
        ) : null}

        <section className="mt-8 break-inside-avoid">
          <div className="mx-auto w-72 border-t border-gray-800 pt-2 text-center">
            <p className="font-medium">{contenido.prescriber?.display_name ?? "—"}</p>
            <p className="text-xs text-gray-600">
              {p.cedula}: {cedula ?? "—"}
            </p>
            <p className="text-xs text-gray-600">{p.firma}</p>
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">{p.leyendaFirma}</p>
        </section>

        <footer className="mt-2 border-t border-gray-300 pt-2 text-xs text-gray-600">
          <p>
            {p.verificacion}: sha256:{documento.sha256}
          </p>
          <p>
            {p.documento} · {mensajes.marca.nombre} · {p.generadoEl}{" "}
            {formatearFechaHora(documento.generated_at, tz)}
          </p>
        </footer>
      </div>
    </div>
  );
}
