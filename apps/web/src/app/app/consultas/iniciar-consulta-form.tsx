"use client";

import { useActionState } from "react";

import { FormAlerts } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { iniciarConsultaDesdeCita } from "@/lib/clinica/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.consultas;

/** Botón de sala de espera: abre (o retoma, es idempotente) la consulta. */
export function IniciarConsultaForm({ appointmentId }: { appointmentId: string }) {
  const [state, action] = useActionState(iniciarConsultaDesdeCita, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <FormAlerts state={state} />
      <SubmitButton size="sm" pendingText={t.iniciando}>
        {t.iniciarConsulta}
      </SubmitButton>
    </form>
  );
}
