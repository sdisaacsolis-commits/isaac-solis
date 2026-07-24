"use client";

import { useActionState } from "react";

import { FormAlerts } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/form-state";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { cancelarMiCita } from "@/lib/portal/actions";

const t = mensajes.mi.citas;

/**
 * Cancelación de la cita del propietario con confirmación explícita; la RPC
 * aplica el plazo de 2 horas (PLAZO_EXCEDIDO) y avisa a la clínica.
 */
export function CancelarCitaForm({ appointmentId }: { appointmentId: string }) {
  const [state, action] = useActionState<FormState, FormData>(cancelarMiCita, initialFormState);

  return (
    <form
      action={action}
      className="flex flex-col gap-2"
      onSubmit={(evento) => {
        if (!window.confirm(t.confirmarCancelar)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <FormAlerts state={state} />
      <div>
        <SubmitButton size="sm" variant="destructive" pendingText={t.cancelando}>
          {t.cancelar}
        </SubmitButton>
      </div>
    </form>
  );
}
