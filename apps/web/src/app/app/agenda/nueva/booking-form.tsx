"use client";

import { FormField, Input } from "@dogtoralia/ui";
import { useActionState, useState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { agendarCita } from "@/lib/agenda/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.agenda.nueva;

interface Props {
  clinicId: string;
  petId: string;
  ownerId: string;
  veterinarianMemberId: string;
  serviceId: string;
  /** Slots disponibles como pares [valor datetime-local, etiqueta legible]. */
  slots: [string, string][];
}

export function BookingForm({
  clinicId,
  petId,
  ownerId,
  veterinarianMemberId,
  serviceId,
  slots,
}: Props) {
  const [state, action] = useActionState(agendarCita, initialFormState);
  const [esUrgencia, setEsUrgencia] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinicId} />
      <input type="hidden" name="petId" value={petId} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="veterinarianMemberId" value={veterinarianMemberId} />
      <input type="hidden" name="serviceIds" value={serviceId} />
      <input type="hidden" name="source" value="staff" />
      <FormAlerts state={state} />

      {esUrgencia ? (
        // Urgencia: la RPC permite agendar fuera de horario (queda auditada),
        // así que se captura la hora libremente en lugar de elegir un slot.
        <FormField
          htmlFor="start-urgencia"
          label={t.fecha}
          required
          error={primerError(state, "start")}
        >
          <Input id="start-urgencia" name="start" type="datetime-local" required />
        </FormField>
      ) : (
        <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium text-ink">{t.horariosDisponibles}</legend>
          {slots.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sinDisponibilidad}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              {slots.map(([valor, etiqueta]) => (
                <div key={valor} className="flex items-center gap-2">
                  <input
                    id={`slot-${valor}`}
                    type="radio"
                    name="start"
                    value={valor}
                    required
                    className="h-4 w-4 border-border accent-brand-600"
                  />
                  <label htmlFor={`slot-${valor}`} className="text-sm text-ink">
                    {etiqueta}
                  </label>
                </div>
              ))}
            </div>
          )}
          {primerError(state, "start") ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {primerError(state, "start")}
            </p>
          ) : null}
        </fieldset>
      )}

      <FormField htmlFor="reason" label={t.motivo} error={primerError(state, "reason")}>
        <Input id="reason" name="reason" />
      </FormField>
      <FormField htmlFor="notes" label={t.notas} error={primerError(state, "notes")}>
        <Input id="notes" name="notes" />
      </FormField>

      <div className="flex items-center gap-2">
        <input
          id="emergency"
          name="emergency"
          type="checkbox"
          checked={esUrgencia}
          onChange={(evento) => setEsUrgencia(evento.target.checked)}
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="emergency" className="text-sm text-ink">
          {t.esUrgencia}
        </label>
      </div>
      {esUrgencia ? (
        <FormField
          htmlFor="emergencyReason"
          label={t.motivoUrgencia}
          required
          error={primerError(state, "emergencyReason")}
        >
          <Input id="emergencyReason" name="emergencyReason" required />
        </FormField>
      ) : null}

      <SubmitButton pendingText={t.agendando}>{t.agendar}</SubmitButton>
    </form>
  );
}
