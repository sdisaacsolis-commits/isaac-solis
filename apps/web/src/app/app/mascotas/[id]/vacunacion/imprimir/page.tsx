import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { formatearFechaHora } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie, nombrePropietario } from "@/lib/pets/format";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";
import { cartillaDeMascota } from "@/lib/vacunacion/queries";

import { BotonImprimirVacunacion } from "../../../../vacunacion/[id]/imprimir/boton-imprimir-vacunacion";

export const metadata: Metadata = { title: mensajes.vacunacion.imprimir.cartilla };

const t = mensajes.vacunacion;
const c = mensajes.vacunacion.cartilla;

/**
 * Cartilla imprimible consolidada: SOLO los eventos accesibles según RLS
 * (jamás datos de otras organizaciones). La bitácora se registra al hacer
 * clic en «Imprimir» con acceso 'card_print' sobre el registro más reciente.
 */
export default async function PaginaImprimirCartilla({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [context, { id }] = await Promise.all([requireTenancyContext(), params]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!context.activeClinic) redirect("/app/mascotas");
  const tz = context.activeClinic.timezone;

  const supabase = await createClient();
  const [{ data: mascota }, { data: relacionPropietario }] = await Promise.all([
    supabase.from("pets").select("id, name, species, breed, birth_date").eq("id", id).maybeSingle(),
    supabase
      .from("pet_owner_relationships")
      .select("owner_id, is_primary, pet_owners(display_name, first_name, last_name)")
      .eq("pet_id", id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!mascota) notFound();

  const propietario = relacionPropietario?.pet_owners as unknown as {
    display_name: string | null;
    first_name: string;
    last_name: string;
  } | null;

  const { filas } = await cartillaDeMascota({
    petId: mascota.id,
    timezone: tz,
    // La cartilla impresa es consolidada: una sola página lógica sin filtros.
    filtros: { page: 1 },
  });

  return (
    <div className="mx-auto max-w-4xl bg-white p-4 text-sm text-gray-900 print:p-0">
      <style>{`@media print { body { background: #fff } header, nav { display: none !important } main { padding: 0 !important; max-width: 100% !important } }`}</style>

      <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
        <a
          className="text-sm text-brand-700 hover:underline"
          href={`/app/mascotas/${mascota.id}/vacunacion`}
        >
          ← {c.titulo}
        </a>
        <BotonImprimirVacunacion recordId={filas[0]?.registro.id ?? null} accessType="card_print" />
      </div>

      <header className="mb-4 border-b-2 border-gray-800 pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-bold">{mensajes.marca.nombre}</h1>
          <p className="text-xs uppercase tracking-widest text-gray-600">{c.titulo}</p>
        </div>
        <p className="font-medium">{mascota.name}</p>
        <p className="text-xs text-gray-600">
          {c.especie}: {etiquetasEspecie[mascota.species]}
          {mascota.breed ? ` · ${mascota.breed}` : ""}
          {mascota.birth_date ? ` · ${c.nacimiento}: ${mascota.birth_date}` : ""}
          {propietario ? ` · ${c.propietario}: ${nombrePropietario(propietario)}` : ""}
        </p>
      </header>

      {filas.length === 0 ? (
        <p className="text-gray-600">{c.sinVacunas}</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-400 text-left">
              <th className="py-1 pr-2 font-semibold">{t.columnaFecha}</th>
              <th className="py-1 pr-2 font-semibold">{t.columnaVacuna}</th>
              <th className="py-1 pr-2 font-semibold">{t.columnaEnfermedades}</th>
              <th className="py-1 pr-2 font-semibold">{t.columnaLote}</th>
              <th className="py-1 pr-2 font-semibold">{t.columnaVeterinario}</th>
              <th className="py-1 pr-2 font-semibold">{t.columnaClinica}</th>
              <th className="py-1 pr-2 font-semibold">{t.columnaProximaDosis}</th>
              <th className="py-1 font-semibold">{t.columnaFuente}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ registro, veterinario, clinica }) => (
              <tr
                key={registro.id}
                className={`border-b border-gray-200 align-top ${
                  registro.status === "voided" ? "text-gray-400 line-through" : ""
                }`}
              >
                <td className="whitespace-nowrap py-1 pr-2">
                  {formatearFechaHora(registro.administered_at, tz)}
                </td>
                <td className="py-1 pr-2 font-medium">
                  {registro.vaccine_name_snapshot}
                  {registro.status === "voided" ? ` (${t.estados.voided})` : ""}
                </td>
                <td className="py-1 pr-2">
                  {registro.diseases_snapshot.length > 0
                    ? registro.diseases_snapshot.join(", ")
                    : "—"}
                </td>
                <td className="py-1 pr-2">
                  {registro.lot_number ?? "—"}
                  {registro.expiration_date ? ` (${registro.expiration_date})` : ""}
                </td>
                <td className="py-1 pr-2">{veterinario ?? "—"}</td>
                <td className="py-1 pr-2">{clinica ?? "—"}</td>
                <td className="py-1 pr-2">{registro.next_due_at ?? "—"}</td>
                <td className="py-1">{t.fuentes[registro.source] ?? registro.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="mt-4 border-t border-gray-300 pt-2 text-xs text-gray-600">
        {c.titulo} · {mensajes.marca.nombre} · {t.aviso}
      </footer>
    </div>
  );
}
