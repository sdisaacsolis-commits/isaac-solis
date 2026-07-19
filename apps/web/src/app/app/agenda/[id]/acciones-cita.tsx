"use client";

import type { AppointmentStatus } from "@dogtoralia/types";
import { APPOINTMENT_TRANSITIONS } from "@dogtoralia/types";
import { Button, FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { cancelarCita, reagendarCita, transicionarCita } from "@/lib/agenda/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.agenda;

/** Botones de transición: solo las transiciones válidas desde el estado actual. */
export function TransicionesCita({
  appointmentId,
  estado,
}: {
  appointmentId: string;
  estado: AppointmentStatus;
}) {
  const [state, action] = useActionState(transicionarCita, initialFormState);
  const disponibles = APPOINTMENT_TRANSITIONS[estado].filter((s) => s !== "cancelled");
  if (disponibles.length === 0) return <FormAlerts state={state} />;

  return (
    <div className="flex flex-col gap-3">
      <FormAlerts state={state} />
      <div className="flex flex-wrap gap-2">
        {disponibles.map((destino) => (
          <form key={destino} action={action}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <input type="hidden" name="newStatus" value={destino} />
            <Button type="submit" variant={destino === "no_show" ? "outline" : "primary"}>
              {t.transiciones[destino] ?? destino}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}

/** Cancelación con motivo obligatorio. */
export function CancelarCitaForm({ appointmentId }: { appointmentId: string }) {
  const [state, action] = useActionState(cancelarCita, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <FormAlerts state={state} />
      <FormField
        htmlFor="cancel-reason"
        label={t.detalle.motivoCancelacion}
        required
        error={primerError(state, "reason")}
      >
        <Input id="cancel-reason" name="reason" required />
      </FormField>
      <div>
        <SubmitButton variant="destructive" pendingText={mensajes.comun.guardando}>
          {t.detalle.cancelarCita}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Reagendar conservando identidad; opcionalmente cambia de veterinario. */
export function ReagendarCitaForm({
  appointmentId,
  veterinarios,
}: {
  appointmentId: string;
  veterinarios: { clinicMemberId: string; nombre: string }[];
}) {
  const [state, action] = useActionState(reagendarCita, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="newStart"
          label={t.detalle.nuevaFechaHora}
          required
          error={primerError(state, "newStart")}
        >
          <Input id="newStart" name="newStart" type="datetime-local" required />
        </FormField>
        <FormField
          htmlFor="newVeterinarianMemberId"
          label={t.detalle.nuevoVeterinario}
          error={primerError(state, "newVeterinarianMemberId")}
        >
          <Select id="newVeterinarianMemberId" name="newVeterinarianMemberId" defaultValue="">
            <option value="">{t.detalle.mantenerVeterinario}</option>
            {veterinarios.map((veterinario) => (
              <option key={veterinario.clinicMemberId} value={veterinario.clinicMemberId}>
                {veterinario.nombre}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        htmlFor="res-reason"
        label={t.detalle.motivoCambio}
        error={primerError(state, "reason")}
      >
        <Input id="res-reason" name="reason" />
      </FormField>
      <div>
        <SubmitButton variant="outline" pendingText={mensajes.comun.guardando}>
          {t.detalle.confirmarReagendar}
        </SubmitButton>
      </div>
    </form>
  );
}
