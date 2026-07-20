"use client";

import { useActionState } from "react";

import { FormAlerts } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { reenviarInvitacion } from "@/lib/tenancy/actions";

export function ResendButton({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState(reenviarInvitacion, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      <SubmitButton pendingText={mensajes.comun.enviando} variant="outline" size="sm">
        {mensajes.personal.invitaciones.reenviar}
      </SubmitButton>
      <FormAlerts state={state} />
    </form>
  );
}
