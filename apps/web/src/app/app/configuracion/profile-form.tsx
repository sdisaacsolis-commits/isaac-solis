"use client";

import { FormField, Input } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { actualizarPerfil } from "@/lib/tenancy/actions";

const t = mensajes.configuracion;

interface Props {
  defaults: {
    firstName: string;
    lastName: string;
    displayName: string;
    phone: string;
    timezone: string;
  };
}

export function ProfileForm({ defaults }: Props) {
  const [state, action] = useActionState(actualizarPerfil, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="firstName"
          label={t.nombre}
          required
          error={primerError(state, "firstName")}
        >
          <Input id="firstName" name="firstName" defaultValue={defaults.firstName} required />
        </FormField>
        <FormField
          htmlFor="lastName"
          label={t.apellido}
          required
          error={primerError(state, "lastName")}
        >
          <Input id="lastName" name="lastName" defaultValue={defaults.lastName} required />
        </FormField>
      </div>
      <FormField
        htmlFor="displayName"
        label={t.nombreMostrar}
        required
        error={primerError(state, "displayName")}
      >
        <Input id="displayName" name="displayName" defaultValue={defaults.displayName} required />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="phone" label={t.telefono} error={primerError(state, "phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} />
        </FormField>
        <FormField htmlFor="timezone" label={t.zonaHoraria} error={primerError(state, "timezone")}>
          <Input id="timezone" name="timezone" defaultValue={defaults.timezone} />
        </FormField>
      </div>
      <SubmitButton pendingText={mensajes.comun.guardando}>{mensajes.comun.guardar}</SubmitButton>
    </form>
  );
}
