import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { SolicitudesEnLinea } from "@/app/app/agenda/solicitudes-en-linea";
import { RatingStars } from "@/components/portal/rating-stars";
import { formatearFechaHora } from "@/lib/agenda/dates";
import { listarSolicitudesEnLinea, metricasAgenda } from "@/lib/agenda/queries";
import { metricasConsultas } from "@/lib/clinica/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { obtenerMetricasAgenda } from "@/lib/metricas/queries";
import { metricasPacientes } from "@/lib/pets/queries";
import { metricasRecetas } from "@/lib/recetas/queries";
import { metricasResenas } from "@/lib/resenas/queries";
import { etiquetasEstadoClinica } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { obtenerPlanDeClinica } from "@/lib/suscripciones/queries";
import { requireTenancyContext } from "@/lib/tenancy/queries";
import { metricasVacunacion } from "@/lib/vacunacion/queries";

export const metadata: Metadata = { title: mensajes.panel.nav.inicio };

const t = mensajes.panel;

export default async function PaginaInicioPanel({
  searchParams,
}: {
  searchParams: Promise<{ bienvenida?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  const supabase = await createClient();

  const [{ count: miembrosActivos }, { count: invitacionesPendientes }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.membership.organization.id)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("clinic_invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  const clinica = context.activeClinic;
  const pacientes = clinica ? await metricasPacientes(clinica.id) : null;
  const [agenda, resumenAgenda, solicitudes] = clinica
    ? await Promise.all([
        metricasAgenda(clinica.id, clinica.timezone),
        obtenerMetricasAgenda(clinica.id, clinica.timezone),
        listarSolicitudesEnLinea(clinica.id),
      ])
    : [null, null, []];
  const consultas = clinica ? await metricasConsultas(clinica.id, clinica.timezone) : null;
  const [recetas, vacunacion] = clinica
    ? await Promise.all([
        metricasRecetas(clinica.id, clinica.timezone),
        metricasVacunacion(clinica.id, clinica.timezone),
      ])
    : [null, null];
  const resenas = clinica ? await metricasResenas(clinica.id) : null;
  const plan = clinica ? await obtenerPlanDeClinica(clinica.id) : null;

  return (
    <div className="flex flex-col gap-6">
      {params.bienvenida ? <Alert variant="success">{mensajes.invitacion.exito}</Alert> : null}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {t.saludo}, {context.profile?.display_name ?? context.email}
        </h1>
        <p className="mt-1 text-ink-muted">
          {t.organizacionActiva}: <strong>{context.membership.organization.name}</strong>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>{t.clinicaActiva}</CardDescription>
            <CardTitle className="text-lg">{clinica ? clinica.name : t.sinClinica}</CardTitle>
          </CardHeader>
          <CardContent>
            {clinica ? (
              <Badge variant={clinica.status === "active" ? "success" : "warning"}>
                {etiquetasEstadoClinica[clinica.status]}
              </Badge>
            ) : (
              <Button asChild size="sm">
                <Link href="/app/clinicas">{mensajes.clinicas.crearPrimera}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t.miembrosActivos}</CardDescription>
            <CardTitle className="text-3xl">{miembrosActivos ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-brand-700 hover:underline" href="/app/personal">
              {t.verPersonal}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t.invitacionesPendientes}</CardDescription>
            <CardTitle className="text-3xl">{invitacionesPendientes ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-brand-700 hover:underline" href="/app/personal">
              {mensajes.personal.invitaciones.titulo}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{mensajes.panel.nav.clinicas}</CardDescription>
            <CardTitle className="text-3xl">{context.clinics.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-brand-700 hover:underline" href="/app/clinicas">
              {t.verClinicas}
            </Link>
          </CardContent>
        </Card>
      </div>

      {plan ? (
        <Card>
          <CardHeader className="p-4">
            <CardDescription>{t.plan.titulo}</CardDescription>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              {plan.planName}
              <Badge
                variant={
                  plan.status === "active" || plan.status === "trialing" ? "success" : "warning"
                }
              >
                {t.plan.estados[plan.status] ?? plan.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">
              {t.plan.veterinariosIncluidos(plan.includedVeterinarians)}
            </p>
            {plan.withinVeterinarianLimit ? null : (
              <p className="text-sm text-destructive">{t.plan.sobreLimite}</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {pacientes ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              [
                mensajes.pacientes.dashboard.propietarios,
                pacientes.propietarios,
                "/app/propietarios",
              ],
              [mensajes.pacientes.dashboard.mascotasActivas, pacientes.mascotas, "/app/mascotas"],
              [mensajes.pacientes.dashboard.perros, pacientes.perros, "/app/mascotas?species=dog"],
              [mensajes.pacientes.dashboard.gatos, pacientes.gatos, "/app/mascotas?species=cat"],
              [mensajes.pacientes.dashboard.esteMes, pacientes.delMes, "/app/mascotas"],
              [mensajes.pacientes.dashboard.alertas, pacientes.alertas, "/app/mascotas"],
            ] as const
          ).map(([titulo, valor, href]) => (
            <Card key={titulo}>
              <CardHeader className="p-4">
                <CardDescription>{titulo}</CardDescription>
                <CardTitle className="text-2xl">
                  <Link className="hover:text-brand-700" href={href}>
                    {valor}
                  </Link>
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {agenda ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [mensajes.agenda.metricas.citasHoy, agenda.citasHoy],
              [mensajes.agenda.metricas.proximasSiete, agenda.proximasSiete],
              [mensajes.agenda.metricas.completadasMes, agenda.completadasMes],
              [mensajes.agenda.metricas.canceladasMes, agenda.canceladasMes],
            ] as const
          ).map(([titulo, valor]) => (
            <Card key={titulo}>
              <CardHeader className="p-4">
                <CardDescription>{titulo}</CardDescription>
                <CardTitle className="text-2xl">
                  <Link className="hover:text-brand-700" href="/app/agenda">
                    {valor}
                  </Link>
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {resumenAgenda ? (
        <section aria-label={mensajes.panel.resumenAgenda.titulo} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {mensajes.panel.resumenAgenda.titulo}
            </h2>
            <p className="text-sm text-ink-muted">{mensajes.panel.resumenAgenda.descripcion}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {(
              [
                [mensajes.panel.resumenAgenda.completadas, resumenAgenda.completadas],
                [mensajes.panel.resumenAgenda.canceladas, resumenAgenda.canceladas],
                [mensajes.panel.resumenAgenda.noShow, resumenAgenda.noShow],
                [mensajes.panel.resumenAgenda.totalPeriodo, resumenAgenda.totalPeriodo],
                [mensajes.panel.resumenAgenda.porConfirmar, resumenAgenda.porConfirmar],
                [mensajes.panel.resumenAgenda.hoy, resumenAgenda.hoy],
              ] as const
            ).map(([titulo, valor]) => (
              <Card key={titulo}>
                <CardHeader className="p-4">
                  <CardDescription>{titulo}</CardDescription>
                  <CardTitle className="text-2xl">
                    <Link className="hover:text-brand-700" href="/app/agenda">
                      {valor}
                    </Link>
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {solicitudes.length > 0 ? (
        <SolicitudesEnLinea
          solicitudes={solicitudes.map(({ cita, mascota, propietario, servicios }) => ({
            appointmentId: cita.id,
            folio: cita.folio,
            fechaLegible: formatearFechaHora(cita.scheduled_start, clinica?.timezone),
            mascota: mascota?.name ?? "—",
            propietario: propietario?.display_name ?? "—",
            servicios: servicios.join(", "),
          }))}
        />
      ) : null}

      {consultas ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              [mensajes.consultas.metricas.abiertasHoy, consultas.abiertas],
              [mensajes.consultas.metricas.finalizadasHoy, consultas.finalizadasHoy],
              [mensajes.consultas.metricas.walkInsHoy, consultas.walkInsHoy],
            ] as const
          ).map(([titulo, valor]) => (
            <Card key={titulo}>
              <CardHeader className="p-4">
                <CardDescription>{titulo}</CardDescription>
                <CardTitle className="text-2xl">
                  <Link className="hover:text-brand-700" href="/app/consultas">
                    {valor}
                  </Link>
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {recetas && vacunacion ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              [mensajes.recetas.metricas.emitidasHoy, recetas.emitidasHoy, "/app/recetas"],
              [
                mensajes.recetas.metricas.borradores,
                recetas.borradores,
                "/app/recetas?estado=draft",
              ],
              [
                mensajes.vacunacion.metricas.aplicadasHoy,
                vacunacion.aplicadasHoy,
                "/app/vacunacion",
              ],
              [mensajes.vacunacion.metricas.proximas30, vacunacion.proximas30, "/app/vacunacion"],
              [
                mensajes.vacunacion.metricas.recordatoriosPendientes,
                vacunacion.recordatoriosPendientes,
                "/app/vacunacion",
              ],
            ] as const
          ).map(([titulo, valor, href]) => (
            <Card key={titulo}>
              <CardHeader className="p-4">
                <CardDescription>{titulo}</CardDescription>
                <CardTitle className="text-2xl">
                  <Link className="hover:text-brand-700" href={href}>
                    {valor}
                  </Link>
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {resenas ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="p-4">
              <CardDescription>{mensajes.resenas.metricas.calificacionPromedio}</CardDescription>
              <CardTitle className="text-2xl">
                <Link className="hover:text-brand-700" href="/app/opiniones">
                  {resenas.average !== null ? (
                    <span className="flex items-center gap-2">
                      {resenas.average.toFixed(1)}
                      <RatingStars value={resenas.average} size="sm" />
                    </span>
                  ) : (
                    <span className="text-base text-ink-muted">
                      {mensajes.resenas.metricas.sinCalificacion}
                    </span>
                  )}
                </Link>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="p-4">
              <CardDescription>{mensajes.resenas.metricas.opinionesNuevas}</CardDescription>
              <CardTitle className="text-2xl">
                <Link className="hover:text-brand-700" href="/app/opiniones">
                  {resenas.ultimos30}
                </Link>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {t.proximamentePacientes.titulo}
              <Badge variant="brand">{mensajes.comun.proximamente}</Badge>
            </CardTitle>
            <CardDescription>{t.proximamentePacientes.texto}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
