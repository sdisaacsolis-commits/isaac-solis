"use client";

import { Alert, FormField, Input } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { mensajes } from "@/lib/i18n/es-mx";
import { type InvitacionPortalState, invitarPropietarioAlPortal } from "@/lib/portal/actions";

const t = mensajes.pacientes.propietarios.portal;
const inicial: InvitacionPortalState = { ok: false };

/**
 * Genera la invitación al portal y muestra el ENLACE una sola vez (solo el
 * hash del token persiste en la base). El correo automático llega en una
 * fase posterior (EMAIL_MODE=dev).
 */
export function PortalInviteForm({
  clinicId,
  ownerId,
  tieneCorreo,
}: {
  clinicId: string;
  ownerId: string;
  tieneCorreo: boolean;
}) {
  const [state, action] = useActionState(invitarPropietarioAlPortal, inicial);

  if (state.ok && state.inviteUrl) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="warning">{t.avisoUnaVez}</Alert>
        <FormField htmlFor="portal-invite-url" label={t.enlace}>
          <Input
            id="portal-invite-url"
            readOnly
            value={state.inviteUrl}
            onFocus={(evento) => evento.target.select()}
          />
        </FormField>
      </div>
    );
  }

  if (!tieneCorreo) {
    return <p className="text-sm text-ink-muted">{t.correoRequerido}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="clinicId" value={clinicId} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <FormAlerts state={state} />
      <div>
        <SubmitButton variant="outline" pendingText={t.invitando}>
          {t.invitar}
        </SubmitButton>
      </div>
    </form>
  );
}
