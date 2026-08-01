import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from "@dogtoralia/ui";
import { publicSlotsQuerySchema } from "@dogtoralia/validation";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RatingStars } from "@/components/portal/rating-stars";
import {
  formatearFechaLarga,
  formatearHora,
  formatearPrecioMXN,
  hoyEnZona,
  sumarDias,
} from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import {
  obtenerClinicaPublica,
  obtenerHuecosPublicos,
  obtenerResenasDeClinica,
} from "@/lib/portal/public";

import { ResenasClinica } from "./resenas-clinica";
import { ReservaForm } from "./reserva-form";

const t = mensajes.portalPublico.clinica;
const tr = mensajes.portalPublico.reserva;
const RESENAS_POR_PAGINA = 20;

interface Params {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servicio?: string; vet?: string; fecha?: string; opiniones?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clinica = await obtenerClinicaPublica(slug);
  if (!clinica) return { title: mensajes.meta.tituloPorDefecto };
  return {
    title: mensajes.portalPublico.meta.tituloClinica(clinica.name),
    description:
      clinica.description ??
      mensajes.portalPublico.meta.descripcionDirectorio(
        mensajes.portalPublico.meta.tituloClinica(clinica.name),
      ),
  };
}

export default async function PaginaClinicaPublica({ params, searchParams }: Params) {
  const [{ slug }, seleccion] = await Promise.all([params, searchParams]);
  const clinica = await obtenerClinicaPublica(slug);
  if (!clinica) notFound();

  // Opiniones (paginación por enlace con offset).
  const paginaResenas = Math.max(1, Number.parseInt(seleccion.opiniones ?? "1", 10) || 1);
  const resenas = await obtenerResenasDeClinica(slug, {
    limit: RESENAS_POR_PAGINA,
    offset: (paginaResenas - 1) * RESENAS_POR_PAGINA,
  });

  const direccion = [
    clinica.address_line_1,
    clinica.address_line_2,
    clinica.neighborhood,
    clinica.city,
    clinica.state,
    clinica.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  // --- Widget de reservación (solo con reservación en línea habilitada) ---
  const hoy = hoyEnZona(clinica.timezone);
  const fechaMinima = sumarDias(hoy, 1);
  const fechaMaxima = sumarDias(hoy, 31);

  const servicio = clinica.services.find((s) => s.id === seleccion.servicio);
  const veterinario = clinica.veterinarians.find((v) => v.clinic_member_id === seleccion.vet);
  const fechaValida =
    typeof seleccion.fecha === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(seleccion.fecha) &&
    seleccion.fecha >= fechaMinima &&
    seleccion.fecha <= fechaMaxima
      ? seleccion.fecha
      : undefined;

  let slots: [string, string][] = [];
  let seleccionCompleta = false;
  if (clinica.accepts_online_booking && servicio && veterinario && fechaValida) {
    const consulta = publicSlotsQuerySchema.safeParse({
      clinicSlug: clinica.slug,
      serviceId: servicio.id,
      veterinarianMemberId: veterinario.clinic_member_id,
      from: fechaValida,
      to: fechaValida,
    });
    if (consulta.success) {
      seleccionCompleta = true;
      const huecos = (await obtenerHuecosPublicos(consulta.data)) ?? [];
      slots = huecos.map((hueco) => [
        hueco.slot_start,
        formatearHora(hueco.slot_start, clinica.timezone),
      ]);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{clinica.name}</h1>
          {clinica.accepts_online_booking ? (
            <Badge variant="brand">{mensajes.portalPublico.buscar.badgeReservacion}</Badge>
          ) : null}
        </div>
        <a
          href="#opiniones"
          className="w-fit rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RatingStars value={clinica.rating.average} count={clinica.rating.count} showCount />
        </a>
        {clinica.description ? (
          <p className="max-w-3xl text-ink-muted">{clinica.description}</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.servicios}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {clinica.services.length === 0 ? (
                <p className="text-sm text-ink-muted">{t.sinServicios}</p>
              ) : (
                clinica.services.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
                  >
                    <div>
                      <p className="font-medium text-ink">{s.name}</p>
                      <p className="text-sm text-ink-muted">
                        {mensajes.servicios.categorias[s.category] ?? s.category} ·{" "}
                        {t.duracion(s.duration_minutes)}
                      </p>
                    </div>
                    <p className="font-semibold text-ink">{formatearPrecioMXN(s.price_cents)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.equipo}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {clinica.veterinarians.length === 0 ? (
                <p className="text-sm text-ink-muted">{t.sinEquipo}</p>
              ) : (
                clinica.veterinarians.map((v) => (
                  <div
                    key={v.clinic_member_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
                  >
                    <div>
                      <p className="font-medium text-ink">{v.display_name ?? "—"}</p>
                      {v.professional_license ? (
                        <p className="text-sm text-ink-muted">{t.cedula(v.professional_license)}</p>
                      ) : null}
                    </div>
                    {v.profile_slug ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/veterinarios/${encodeURIComponent(v.profile_slug)}`}>
                          {t.verPerfilVet}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{t.contacto}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {direccion ? (
              <p className="text-ink">
                <span className="font-medium">{t.direccion}: </span>
                {direccion}
              </p>
            ) : null}
            {clinica.phone ? (
              <p className="text-ink">
                <span className="font-medium">{t.telefono}: </span>
                <a className="text-brand-700 hover:underline" href={`tel:${clinica.phone}`}>
                  {clinica.phone}
                </a>
              </p>
            ) : null}
            {!clinica.accepts_online_booking ? (
              <Alert variant="info">{t.sinReservacion}</Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {clinica.accepts_online_booking ? (
        <Card id="reservar">
          <CardHeader>
            <CardTitle>{tr.titulo}</CardTitle>
            <CardDescription>{tr.pasoSeleccion}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <form
              method="get"
              action={`/clinicas/${encodeURIComponent(clinica.slug)}`}
              className="grid gap-4 sm:grid-cols-4"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="widget-servicio" className="text-sm font-medium text-ink">
                  {tr.servicio}
                </label>
                <Select
                  id="widget-servicio"
                  name="servicio"
                  required
                  defaultValue={servicio?.id ?? ""}
                >
                  <option value="" disabled>
                    {tr.elige}
                  </option>
                  {clinica.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {formatearPrecioMXN(s.price_cents)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="widget-vet" className="text-sm font-medium text-ink">
                  {tr.veterinario}
                </label>
                <Select
                  id="widget-vet"
                  name="vet"
                  required
                  defaultValue={veterinario?.clinic_member_id ?? ""}
                >
                  <option value="" disabled>
                    {tr.elige}
                  </option>
                  {clinica.veterinarians.map((v) => (
                    <option key={v.clinic_member_id} value={v.clinic_member_id}>
                      {v.display_name ?? "—"}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="widget-fecha" className="text-sm font-medium text-ink">
                  {tr.fecha}
                </label>
                <Input
                  id="widget-fecha"
                  name="fecha"
                  type="date"
                  required
                  min={fechaMinima}
                  max={fechaMaxima}
                  defaultValue={fechaValida ?? fechaMinima}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="outline" className="w-full">
                  {tr.verHorarios}
                </Button>
              </div>
            </form>

            {seleccionCompleta && servicio && veterinario && fechaValida ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold capitalize text-ink">
                  {formatearFechaLarga(fechaValida, clinica.timezone)}
                </h2>
                <p className="text-sm font-medium text-ink">{tr.pasoDatos}</p>
                <ReservaForm
                  clinicSlug={clinica.slug}
                  serviceId={servicio.id}
                  veterinarianMemberId={veterinario.clinic_member_id}
                  slots={slots}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <ResenasClinica
        slug={clinica.slug}
        datos={resenas}
        pagina={paginaResenas}
        porPagina={RESENAS_POR_PAGINA}
      />
    </div>
  );
}
