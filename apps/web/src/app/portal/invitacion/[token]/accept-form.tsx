"use client";

import { useActionState } from "react";

import { FormAlerts } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { aceptarInvitacionPortal } from "@/lib/portal/actions";

const t = mensajes.mi.invitacion;

/** La vinculación exige un clic explícito; nunca ocurre al abrir el enlace. */
export function AcceptPortalForm({ token }: { token: string }) {
  const [state, action] = useActionState(aceptarInvitacionPortal, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <FormAlerts state={state} />
      <SubmitButton pendingText={t.aceptando}>{t.aceptar}</SubmitButton>
    </form>
  );
}
