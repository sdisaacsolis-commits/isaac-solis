"use client";

import { FormField, Input } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { iniciarSesion } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.auth.iniciarSesion;

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(iniciarSesion, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormAlerts state={state} />
      <FormField htmlFor="email" label={t.correo} required error={primerError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(primerError(state, "email"))}
        />
      </FormField>
      <FormField
        htmlFor="password"
        label={t.contrasena}
        required
        error={primerError(state, "password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(primerError(state, "password"))}
        />
      </FormField>
      <SubmitButton pendingText={t.botonCargando}>{t.boton}</SubmitButton>
      <div className="flex flex-col gap-1 text-center text-sm text-ink-muted">
        <Link className="text-brand-700 hover:underline" href="/recuperar-contrasena">
          {t.olvide}
        </Link>
        <p>
          {t.sinCuenta}{" "}
          <Link
            className="text-brand-700 hover:underline"
            href={next ? `/registro?next=${encodeURIComponent(next)}` : "/registro"}
          >
            {t.registrate}
          </Link>
        </p>
      </div>
    </form>
  );
}
