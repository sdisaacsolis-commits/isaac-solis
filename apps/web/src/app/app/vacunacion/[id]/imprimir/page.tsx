import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora, formatearFechaLarga } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";
import { contenidoVacunacionSchema } from "@/lib/vacunacion/documento";
import { obtenerVacunacion } from "@/lib/vacunacion/queries";

import { BotonImprimirVacunacion } from "./boton-imprimir-vacunacion";

export const metadata: Metadata = { title: mensajes.vacunacion.imprimir.comprobante };

const t = mensajes.vacunacion;
const p = mensajes.vacunacion.imprimir;
const d = mensajes.vacunacion.detalle;

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-xs text-gray-600">{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

/**
 * Comprobante individual imprimible. Con documento congelado
 * (vaccination_documents.content) se renderiza el snapshot y su hash; los
 * históricos sin documento se presentan desde el registro con la fuente
 * claramente etiquetada. La bitácora se registra al hacer clic en «Imprimir».
 */
export default async function PaginaImprimirVacunacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [context, { id }] = await Promise.all([requireTenancyContext(), params]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!context.activeClinic) redirect("/app/vacunacion");

  const detalle = await obtenerVacunacion(id);
  if (!detalle) notFound();
  const { registro, documento, mascota, veterinario, clinica } = detalle;
  const tz = clinica?.timezone ?? context.activeClinic.timezone;

  const parseado = documento ? contenidoVacunacionSchema.safeParse(documento.content) : null;
  const contenido = parseado?.success ? parseado.data : null;

  // Con snapshot congelado, TODO sale del documento; sin él (históricos), del registro.
  const nombreVacuna = contenido?.vaccine_name ?? registro.vaccine_name_snapshot;
  const fabricante = contenido?.manufacturer ?? registro.manufacturer_snapshot;
  const enfermedades = contenido?.diseases ?? registro.diseases_snapshot;
  const lote = contenido?.lot_number ?? registro.lot_number;
  const caducidad = contenido?.expiration_date ?? registro.expiration_date;
  const aplicadaEl = contenido?.administered_at ?? registro.administered_at;
  const proximaDosis = contenido?.next_due_at ?? registro.next_due_at;

  return (
    <div className="mx-auto max-w-3xl bg-white p-4 text-sm text-gray-900 print:p-0">
      <style>{`@media print { body { background: #fff } header, nav { display: none !important } main { padding: 0 !important; max-width: 100% !important } }`}</style>

      <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
        <a
          className="text-sm text-brand-700 hover:underline"
          href={`/app/vacunacion/${registro.id}`}
        >
          ← {d.titulo}
        </a>
        <BotonImprimirVacunacion recordId={registro.id} accessType="print" />
      </div>

      {registro.status === "voided" ? (
        <div className="mb-4 border-4 border-red-700 py-2 text-center text-xl font-extrabold uppercase tracking-widest text-red-700">
          {p.marcaAnulada}
        </div>
      ) : null}

      <header className="mb-4 border-b-2 border-gray-800 pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">{mensajes.marca.nombre}</h1>
          <p className="text-xs uppercase tracking-widest text-gray-600">{p.comprobante}</p>
        </div>
        <p className="font-medium">{contenido?.clinic?.name ?? clinica?.name ?? "—"}</p>
      </header>

      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          {t.fuentes[registro.source] ?? registro.source}
        </p>
        {!contenido ? <p className="text-xs text-gray-600">{p.leyendaHistorico}</p> : null}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div>
            <dt className="text-xs text-gray-600">{d.vacuna}</dt>
            <dd className="font-semibold">{nombreVacuna}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">{d.aplicadaEl}</dt>
            <dd>{aplicadaEl ? formatearFechaHora(aplicadaEl, tz) : "—"}</dd>
          </div>
          <Campo etiqueta={d.fabricante} valor={fabricante} />
          <Campo
            etiqueta={d.enfermedades}
            valor={enfermedades && enfermedades.length > 0 ? enfermedades.join(", ") : null}
          />
          <Campo etiqueta={d.lote} valor={lote} />
          <Campo etiqueta={d.caducidad} valor={caducidad} />
          <Campo etiqueta={d.via} valor={contenido?.route_text ?? registro.route_text} />
          <Campo
            etiqueta={d.sitio}
            valor={contenido?.application_site ?? registro.application_site}
          />
          <Campo etiqueta={d.dosis} valor={contenido?.dose_text ?? registro.dose_text} />
          <Campo
            etiqueta={d.proximaDosis}
            valor={proximaDosis ? formatearFechaLarga(proximaDosis, tz) : null}
          />
          <Campo etiqueta={d.proveedorExterno} valor={registro.historical_provider_name} />
        </dl>

        <section className="break-inside-avoid">
          <h2 className="mb-1 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
            {d.mascota}
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div>
              <dt className="text-xs text-gray-600">{d.mascota}</dt>
              <dd className="font-medium">{contenido?.pet?.name ?? mascota?.name ?? "—"}</dd>
            </div>
            <Campo
              etiqueta={t.cartilla.especie}
              valor={contenido?.pet?.species ?? mascota?.species ?? null}
            />
            <Campo
              etiqueta={t.cartilla.nacimiento}
              valor={contenido?.pet?.birth_date ?? mascota?.birth_date ?? null}
            />
          </dl>
        </section>

        {(contenido?.veterinarian?.display_name ?? veterinario) ? (
          <section className="break-inside-avoid">
            <h2 className="mb-1 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
              {d.veterinario}
            </h2>
            <p>
              {contenido?.veterinarian?.display_name ?? veterinario}
              {contenido?.veterinarian?.professional_license
                ? ` · ${mensajes.recetas.imprimir.cedula}: ${contenido.veterinarian.professional_license}`
                : ""}
            </p>
          </section>
        ) : null}

        <footer className="mt-2 border-t border-gray-300 pt-2 text-xs text-gray-600">
          {documento ? (
            <p>
              {p.verificacion}: sha256:{documento.sha256}
            </p>
          ) : null}
          <p>
            {p.comprobante} · {mensajes.marca.nombre} ·{" "}
            {documento
              ? `${p.generadoEl} ${formatearFechaHora(documento.generated_at, tz)}`
              : (t.fuentes[registro.source] ?? registro.source)}
          </p>
        </footer>
      </div>
    </div>
  );
}
