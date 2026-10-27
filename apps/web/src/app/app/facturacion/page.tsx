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

import { formatearFecha, formatearPrecioMXN } from "@/lib/agenda/dates";
import { iniciarCheckout } from "@/lib/facturacion/actions";
import { listarPlanesPublicos, obtenerSuscripcionDeClinica } from "@/lib/facturacion/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { puedeAdministrarClinica } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { obtenerPlanDeClinica } from "@/lib/suscripciones/queries";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.panel.facturacion.titulo };

const t = mensajes.panel.facturacion;
const estados = mensajes.panel.plan.estados;

type EstadoCheckout = "exito" | "cancelado" | "error" | "sin-permiso";

function alertaDeEstado(estado: string | undefined): React.ReactNode {
  switch (estado as EstadoCheckout | undefined) {
    case "exito":
      return <Alert variant="success">{t.checkoutExito}</Alert>;
    case "cancelado":
      return <Alert>{t.checkoutCancelado}</Alert>;
    case "error":
      return <Alert variant="destructive">{t.checkoutError}</Alert>;
    case "sin-permiso":
      return <Alert variant="destructive">{t.errores.sinPermiso}</Alert>;
    default:
      return null;
  }
}

export default async function PaginaFacturacion({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  const clinica = context.activeClinic;

  if (!clinica) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <Alert>{t.sinClinica}</Alert>
      </div>
    );
  }

  const supabase = await createClient();
  const [plan, suscripcion, planes, { data: vets }] = await Promise.all([
    obtenerPlanDeClinica(clinica.id),
    obtenerSuscripcionDeClinica(clinica.id),
    listarPlanesPublicos(),
    supabase.rpc("clinic_active_veterinarian_count", { p_clinic_id: clinica.id }),
  ]);

  const rolClinica =
    context.clinicMemberships.find((m) => m.clinic_id === clinica.id)?.role ?? null;
  const puedeAdministrar = puedeAdministrarClinica(context.membership.role, rolClinica);
  const adicionales = Math.max(0, (typeof vets === "number" ? vets : 1) - 1);

  const finPeriodo = suscripcion?.currentPeriodEnd ?? null;
  const finVigente = finPeriodo !== null && new Date(finPeriodo).getTime() > Date.now();
  const estado = suscripcion?.status ?? null;
  const vencida =
    estado === "canceled" ||
    ((estado === "active" || estado === "trialing") && finPeriodo !== null && !finVigente);

  return (
    <div className="flex flex-col gap-6">
      {alertaDeEstado(params.estado)}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="mt-1 text-ink-muted">{t.descripcion}</p>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>{t.estadoTitulo}</CardDescription>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {plan?.planName ?? mensajes.comun.sinDatos}
            {estado !== null ? (
              <Badge variant={vencida ? "warning" : estado === "past_due" ? "warning" : "success"}>
                {estados[estado] ?? estado}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-ink-muted">
          {vencida ? (
            <p className="text-destructive">{t.vencida}</p>
          ) : estado === "past_due" ? (
            <p className="text-destructive">{t.pagoPendiente}</p>
          ) : estado === "trialing" && finPeriodo !== null ? (
            <p>{t.pruebaTermina(formatearFecha(finPeriodo, clinica.timezone))}</p>
          ) : estado === "active" && finPeriodo !== null ? (
            <p>{t.vigenteHasta(formatearFecha(finPeriodo, clinica.timezone))}</p>
          ) : null}
          <p>{t.soloLecturaNota}</p>
        </CardContent>
      </Card>

      <section aria-label={t.planesTitulo} className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">{t.planesTitulo}</h2>
        {puedeAdministrar ? (
          <p className="text-sm text-ink-muted">{t.resumenCobro(adicionales)}</p>
        ) : (
          <p className="text-sm text-ink-muted">{t.soloAdmins}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {planes.map((p) => (
            <Card key={p.code}>
              <CardHeader>
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <CardDescription>
                  {p.billingInterval === "month"
                    ? t.porMes(formatearPrecioMXN(p.priceCents))
                    : t.porAnio(formatearPrecioMXN(p.priceCents))}{" "}
                  {t.masIva} · {t.porClinica}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-ink-muted">
                <p>{t.incluido}</p>
                {p.additionalVeterinarianPriceCents !== null ? (
                  <p>{t.vetAdicional(formatearPrecioMXN(p.additionalVeterinarianPriceCents))}</p>
                ) : null}
                {p.billingInterval === "year" ? <p>{t.ahorroAnual}</p> : null}
                {puedeAdministrar ? (
                  <form action={iniciarCheckout} className="mt-2">
                    <input type="hidden" name="clinicId" value={clinica.id} />
                    <input type="hidden" name="planCode" value={p.code} />
                    <Button type="submit">{t.pagar}</Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
        {planes.length === 0 ? <Alert>{t.noConfigurado}</Alert> : null}
      </section>
    </div>
  );
}
