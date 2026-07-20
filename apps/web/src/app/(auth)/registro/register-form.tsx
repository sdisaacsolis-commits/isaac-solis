"use client";

import { FormField, Input } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { registrarse } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.auth.registro;

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(registrarse, initialFormState);

  if (state.ok && state.message) {
    return <FormAlerts state={state} />;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="firstName"
          label={t.nombre}
          required
          error={primerError(state, "firstName")}
        >
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </FormField>
        <FormField
          htmlFor="lastName"
          label={t.apellido}
          required
          error={primerError(state, "lastName")}
        >
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </FormField>
      </div>
      <FormField htmlFor="email" label={t.correo} required error={primerError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <FormField
        htmlFor="password"
        label={t.contrasena}
        required
        hint={t.pistaContrasena}
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
      <div className="flex items-start gap-2">
        <input
          id="acceptTerms"
          name="acceptTerms"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="acceptTerms" className="text-sm text-ink">
          {t.aceptoTerminos}
        </label>
      </div>
      {primerError(state, "acceptTerms") ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {primerError(state, "acceptTerms")}
        </p>
      ) : null}
      <SubmitButton pendingText={t.botonCargando}>{t.boton}</SubmitButton>
      <p className="text-center text-sm text-ink-muted">
        {t.yaTienesCuenta}{" "}
        <Link
          className="text-brand-700 hover:underline"
          href={next ? `/iniciar-sesion?next=${encodeURIComponent(next)}` : "/iniciar-sesion"}
        >
          {t.inicia}
        </Link>
      </p>
    </form>
  );
}
