"use client";

import { FormField, Input } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { anularVacunacion } from "@/lib/vacunacion/actions";

const t = mensajes.vacunacion.detalle;

/** Anulación administrativa con motivo obligatorio y confirmación. */
export function AnularVacunacionForm({ recordId, petId }: { recordId: string; petId: string }) {
  const [state, action] = useActionState(anularVacunacion, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(evento) => {
        if (!window.confirm(t.confirmarAnular)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="recordId" value={recordId} />
      <input type="hidden" name="petId" value={petId} />
      <FormAlerts state={state} />
      <FormField
        htmlFor="void-vac-reason"
        label={t.motivoAnulacion}
        required
        error={primerError(state, "reason")}
      >
        <Input id="void-vac-reason" name="reason" required />
      </FormField>
      <p className="text-xs text-ink-muted">{t.soloAdminAnula}</p>
      <div>
        <SubmitButton variant="destructive" pendingText={t.anulando}>
          {t.anular}
        </SubmitButton>
      </div>
    </form>
  );
}
