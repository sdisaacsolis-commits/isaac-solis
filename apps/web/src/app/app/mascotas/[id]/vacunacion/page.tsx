import type { VaccinationRecordStatus, VaccinationSource } from "@dogtoralia/types";
import { VACCINATION_RECORD_STATUSES, VACCINATION_SOURCES } from "@dogtoralia/types";
import {
  Badge,
  Button,
  Input,
  Select,
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
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie, nombrePropietario } from "@/lib/pets/format";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";
import { varianteEstadoVacunacion, varianteFuenteVacunacion } from "@/lib/vacunacion/presentacion";
import { cartillaDeMascota, TAMANO_PAGINA_VACUNACION } from "@/lib/vacunacion/queries";

export const metadata: Metadata = { title: mensajes.vacunacion.cartilla.titulo };

const t = mensajes.vacunacion;
const c = mensajes.vacunacion.cartilla;

export default async function PaginaCartillaMascota({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    anio?: string;
    estado?: string;
    fuente?: string;
    vacuna?: string;
    proximas?: string;
    page?: string;
  }>;
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
  const tz = context.activeClinic.timezone;

  const supabase = await createClient();
  const [{ data: mascota }, { data: relacionPropietario }] = await Promise.all([
    supabase.from("pets").select("id, name, species, birth_date").eq("id", id).maybeSingle(),
    supabase
      .from("pet_owner_relationships")
      .select("owner_id, is_primary, pet_owners(id, display_name, first_name, last_name)")
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

  const estado = VACCINATION_RECORD_STATUSES.includes(query.estado as VaccinationRecordStatus)
    ? (query.estado as VaccinationRecordStatus)
    : undefined;
  const fuente = VACCINATION_SOURCES.includes(query.fuente as VaccinationSource)
    ? (query.fuente as VaccinationSource)
    : undefined;
  const anio = /^\d{4}$/.test(query.anio ?? "") ? Number(query.anio) : undefined;
  const vacuna = query.vacuna?.trim() || undefined;
  const proximas = query.proximas === "1";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const { filas, total } = await cartillaDeMascota({
    petId: mascota.id,
    timezone: tz,
    filtros: { anio, estado, fuente, vacuna, proximas, page },
  });
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_VACUNACION));
  const enlacePagina = (destino: number) => {
    const parametros = new URLSearchParams();
    if (anio) parametros.set("anio", String(anio));
    if (estado) parametros.set("estado", estado);
    if (fuente) parametros.set("fuente", fuente);
    if (vacuna) parametros.set("vacuna", vacuna);
    if (proximas) parametros.set("proximas", "1");
    parametros.set("page", String(destino));
    return `/app/mascotas/${mascota.id}/vacunacion?${parametros.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            className="text-sm text-brand-700 hover:underline"
            href={`/app/mascotas/${mascota.id}`}
          >
            {c.volverAMascota}
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
            {c.titulo} — {mascota.name}
          </h1>
          <p className="text-sm text-ink-muted">
            {c.especie}: {etiquetasEspecie[mascota.species]}
            {mascota.birth_date ? ` · ${c.nacimiento}: ${mascota.birth_date}` : ""}
            {propietario ? ` · ${c.propietario}: ${nombrePropietario(propietario)}` : ""}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/app/mascotas/${mascota.id}/vacunacion/imprimir`}>{c.imprimirCartilla}</Link>
        </Button>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="anio" className="text-sm font-medium text-ink">
            {t.filtroAnio}
          </label>
          <Input
            id="anio"
            name="anio"
            type="number"
            min={2000}
            max={2100}
            defaultValue={anio ?? ""}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado" className="text-sm font-medium text-ink">
            {t.filtroEstado}
          </label>
          <Select id="estado" name="estado" defaultValue={estado ?? ""}>
            <option value="">{t.todos}</option>
            {VACCINATION_RECORD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.estados[s] ?? s}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fuente" className="text-sm font-medium text-ink">
            {t.filtroFuente}
          </label>
          <Select id="fuente" name="fuente" defaultValue={fuente ?? ""}>
            <option value="">{t.todas}</option>
            {VACCINATION_SOURCES.map((f) => (
              <option key={f} value={f}>
                {t.fuentes[f] ?? f}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vacuna" className="text-sm font-medium text-ink">
            {t.filtroVacuna}
          </label>
          <Input id="vacuna" name="vacuna" defaultValue={vacuna ?? ""} />
        </div>
        <div className="flex items-center gap-2 pb-2.5">
          <input
            id="proximas"
            name="proximas"
            type="checkbox"
            value="1"
            defaultChecked={proximas}
            className="h-4 w-4 rounded border-border accent-brand-600"
          />
          <label htmlFor="proximas" className="text-sm text-ink">
            {t.filtroProximas}
          </label>
        </div>
        <Button type="submit" variant="outline">
          {t.filtrar}
        </Button>
      </form>

      {filas.length === 0 ? (
        <p className="text-ink-muted">{c.sinVacunas}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnaFecha}</TableHead>
              <TableHead>{t.columnaVacuna}</TableHead>
              <TableHead>{t.columnaEnfermedades}</TableHead>
              <TableHead>{t.columnaFabricante}</TableHead>
              <TableHead>{t.columnaLote}</TableHead>
              <TableHead>{t.columnaCaducidad}</TableHead>
              <TableHead>{t.columnaVeterinario}</TableHead>
              <TableHead>{t.columnaClinica}</TableHead>
              <TableHead>{t.columnaProximaDosis}</TableHead>
              <TableHead>{t.columnaFuente}</TableHead>
              <TableHead>{t.columnaEstado}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map(({ registro, veterinario, clinica }) => (
              <TableRow key={registro.id}>
                <TableCell className="whitespace-nowrap">
                  {formatearFechaHora(registro.administered_at, tz)}
                </TableCell>
                <TableCell>
                  <Link
                    className={`font-medium text-brand-700 hover:underline ${
                      registro.status === "voided" ? "line-through" : ""
                    }`}
                    href={`/app/vacunacion/${registro.id}`}
                  >
                    {registro.vaccine_name_snapshot}
                  </Link>
                </TableCell>
                <TableCell className="max-w-44 truncate">
                  {registro.diseases_snapshot.length > 0
                    ? registro.diseases_snapshot.join(", ")
                    : "—"}
                </TableCell>
                <TableCell>{registro.manufacturer_snapshot ?? "—"}</TableCell>
                <TableCell>{registro.lot_number ?? "—"}</TableCell>
                <TableCell>{registro.expiration_date ?? "—"}</TableCell>
                <TableCell>{veterinario ?? "—"}</TableCell>
                <TableCell>{clinica ?? "—"}</TableCell>
                <TableCell>{registro.next_due_at ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={varianteFuenteVacunacion(registro.source)}>
                    {t.fuentes[registro.source] ?? registro.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={varianteEstadoVacunacion(registro.status)}>
                    {t.estados[registro.status] ?? registro.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPaginas > 1 ? (
        <nav aria-label={c.titulo} className="flex items-center gap-4 text-sm">
          {page > 1 ? (
            <Link className="text-brand-700 hover:underline" href={enlacePagina(page - 1)}>
              {mensajes.comun.paginaAnterior}
            </Link>
          ) : null}
          <span className="text-ink-muted">{mensajes.comun.paginaDe(page, totalPaginas)}</span>
          {page < totalPaginas ? (
            <Link className="text-brand-700 hover:underline" href={enlacePagina(page + 1)}>
              {mensajes.comun.paginaSiguiente}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
