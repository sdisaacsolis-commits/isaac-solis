"use client";

import { FormField, Input } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { solicitarRecuperacion } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.auth.recuperar;

export function RecoverForm() {
  const [state, action] = useActionState(solicitarRecuperacion, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlerts state={state} />
      {!state.ok ? (
        <>
          <FormField htmlFor="email" label={t.correo} required error={primerError(state, "email")}>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </FormField>
          <SubmitButton pendingText={t.botonCargando}>{t.boton}</SubmitButton>
        </>
      ) : null}
      <p className="text-center text-sm">
        <Link className="text-brand-700 hover:underline" href="/iniciar-sesion">
          {t.volver}
        </Link>
      </p>
    </form>
  );
}
