"use client";

import { Button, Input } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { cancelarCita, transicionarCita } from "@/lib/agenda/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.agenda.solicitudes;

export interface SolicitudEnLinea {
  appointmentId: string;
  folio: string;
  fechaLegible: string;
  mascota: string;
  propietario: string;
  servicios: string;
}

/**
 * Acciones sobre una solicitud en línea: Confirmar reutiliza la transición de
 * agenda (requested → confirmed) y Rechazar la cancelación existente (con
 * motivo obligatorio). La RPC valida permisos y anti-traslape al confirmar.
 */
function AccionesSolicitud({ appointmentId }: { appointmentId: string }) {
  const [confirmarState, confirmarAction] = useActionState(transicionarCita, initialFormState);
  const [rechazarState, rechazarAction] = useActionState(cancelarCita, initialFormState);

  return (
    <div className="flex flex-col gap-2">
      <FormAlerts state={confirmarState} />
      <FormAlerts state={rechazarState} />
      <div className="flex flex-wrap items-end gap-2">
        <form action={confirmarAction}>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="newStatus" value="confirmed" />
          <SubmitButton size="sm" pendingText={mensajes.comun.guardando}>
            {t.confirmar}
          </SubmitButton>
        </form>
        <form action={rechazarAction} className="flex flex-wrap items-end gap-2" noValidate>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <div className="flex flex-col gap-1">
            <label
              htmlFor={`rechazo-${appointmentId}`}
              className="text-xs font-medium text-ink-muted"
            >
              {t.motivoRechazo}
            </label>
            <Input
              id={`rechazo-${appointmentId}`}
              name="reason"
              required
              className="h-8 w-56 text-xs"
            />
          </div>
          <SubmitButton size="sm" variant="outline" pendingText={mensajes.comun.guardando}>
            {t.rechazar}
          </SubmitButton>
          {primerError(rechazarState, "reason") ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {primerError(rechazarState, "reason")}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export function SolicitudesEnLinea({ solicitudes }: { solicitudes: SolicitudEnLinea[] }) {
  if (solicitudes.length === 0) return null;

  return (
    <section
      aria-label={t.titulo}
      className="flex flex-col gap-3 rounded-xl border border-accent-500 bg-accent-400/10 p-4"
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">
          {t.titulo} <span className="text-ink-muted">({solicitudes.length})</span>
        </h2>
        <p className="text-sm text-ink-muted">{t.descripcion}</p>
      </div>
      <div className="flex flex-col gap-3">
        {solicitudes.map((solicitud) => (
          <div
            key={solicitud.appointmentId}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium text-ink">
                  <Link
                    className="text-brand-700 hover:underline"
                    href={`/app/agenda/${solicitud.appointmentId}`}
                  >
                    {solicitud.folio}
                  </Link>{" "}
                  · {solicitud.fechaLegible}
                </p>
                <p className="text-ink-muted">
                  {solicitud.mascota} · {solicitud.propietario}
                  {solicitud.servicios ? ` · ${solicitud.servicios}` : ""}
                </p>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/app/agenda/${solicitud.appointmentId}`}>
                  {mensajes.agenda.detalle.titulo}
                </Link>
              </Button>
            </div>
            <AccionesSolicitud appointmentId={solicitud.appointmentId} />
          </div>
        ))}
      </div>
    </section>
  );
}
