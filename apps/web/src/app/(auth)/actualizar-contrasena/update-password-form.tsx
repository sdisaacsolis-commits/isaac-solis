"use client";

import { Button, FormField, Input } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { actualizarContrasena } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.auth.actualizar;

export function UpdatePasswordForm() {
  const [state, action] = useActionState(actualizarContrasena, initialFormState);

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlerts state={state} />
        <Button asChild>
          <Link href="/app/inicio">{t.irAlPanel}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlerts state={state} />
      <FormField
        htmlFor="password"
        label={t.contrasena}
        required
        hint={mensajes.auth.registro.pistaContrasena}
        error={primerError(state, "password")}
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </FormField>
      <FormField
        htmlFor="confirmPassword"
        label={t.confirmarContrasena}
        required
        error={primerError(state, "confirmPassword")}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </FormField>
      <SubmitButton pendingText={t.botonCargando}>{t.boton}</SubmitButton>
    </form>
  );
}
