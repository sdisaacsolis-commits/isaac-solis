"use client";

import { useActionState } from "react";

import { FormAlerts } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

import { aceptarInvitacion } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action] = useActionState(aceptarInvitacion, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormAlerts state={state} />
      <SubmitButton pendingText={mensajes.invitacion.aceptando} size="lg">
        {mensajes.invitacion.aceptar}
      </SubmitButton>
    </form>
  );
}
