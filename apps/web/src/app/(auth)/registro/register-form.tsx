"use client";

import { FormField, Input } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState, useState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { registrarse } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.auth.registro;

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState(registrarse, initialFormState);
  const [mostrar, setMostrar] = useState(false);
  const [datos, setDatos] = useState({
    firstName: "",
    lastName: "",
    email: "",
    acceptTerms: false,
  });
  const loginHref = next ? `/iniciar-sesion?next=${encodeURIComponent(next)}` : "/iniciar-sesion";
  const passwordError = primerError(state, "password");
  const termsError = primerError(state, "acceptTerms");
  const commonInput = "min-h-12 text-base";
  const update = (name: "firstName" | "lastName" | "email", value: string) =>
    setDatos((prev) => ({ ...prev, [name]: value }));

  if (state.ok && state.message) {
    return (
      <section className="flex flex-col gap-4" aria-live="polite">
        <h2 className="text-lg font-semibold">{t.revisaCorreoTitulo}</h2>
        <FormAlerts state={state} />
        <Link className="w-fit font-medium text-brand-700 underline" href={loginHref}>
          {t.volverInicioSesion}
        </Link>
      </section>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" onSubmit={() => setMostrar(false)}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="firstName"
          label={t.nombre}
          required
          error={primerError(state, "firstName")}
        >
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            required
            className={commonInput}
            value={datos.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            aria-invalid={!!primerError(state, "firstName")}
            aria-describedby={primerError(state, "firstName") ? "firstName-error" : undefined}
          />
        </FormField>
        <FormField
          htmlFor="lastName"
          label={t.apellido}
          required
          error={primerError(state, "lastName")}
        >
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            required
            className={commonInput}
            value={datos.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            aria-invalid={!!primerError(state, "lastName")}
            aria-describedby={primerError(state, "lastName") ? "lastName-error" : undefined}
          />
        </FormField>
      </div>
      <FormField htmlFor="email" label={t.correo} required error={primerError(state, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className={commonInput}
          value={datos.email}
          onChange={(e) => update("email", e.target.value)}
          aria-invalid={!!primerError(state, "email")}
          aria-describedby={primerError(state, "email") ? "email-error" : undefined}
        />
      </FormField>
      <FormField htmlFor="password" label={t.contrasena} required error={passwordError}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={mostrar ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            className="min-h-12 pe-24 text-base"
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? "password-hint password-error" : "password-hint"}
          />
          <button
            type="button"
            aria-controls="password"
            aria-label={mostrar ? t.ocultarContrasenaAccesible : t.mostrarContrasenaAccesible}
            onClick={() => setMostrar((prev) => !prev)}
            className="absolute end-1 top-0 min-h-12 rounded px-3 text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {mostrar ? t.ocultarContrasena : t.mostrarContrasena}
          </button>
        </div>
        <p id="password-hint" className="text-xs text-ink-muted">
          {t.pistaContrasena}
        </p>
      </FormField>
      <div className="flex min-h-12 items-start gap-3">
        <input
          id="acceptTerms"
          name="acceptTerms"
          type="checkbox"
          required
          checked={datos.acceptTerms}
          onChange={(e) => setDatos((prev) => ({ ...prev, acceptTerms: e.target.checked }))}
          aria-invalid={!!termsError}
          aria-describedby={termsError ? "acceptTerms-error" : undefined}
          className="mt-2 h-5 w-5 shrink-0 rounded border-border accent-brand-600"
        />
        <label htmlFor="acceptTerms" className="py-2 text-sm text-ink">
          {t.aceptoInicio}{" "}
          <Link
            href="/terminos"
            target="_blank"
            rel="noopener"
            className="font-medium text-brand-700 underline"
          >
            {t.terminos}
          </Link>{" "}
          {t.yEl}{" "}
          <Link
            href="/aviso-de-privacidad"
            target="_blank"
            rel="noopener"
            className="font-medium text-brand-700 underline"
          >
            {t.privacidad}
          </Link>
          .
        </label>
      </div>
      {termsError ? (
        <p id="acceptTerms-error" role="alert" className="text-xs font-medium text-destructive">
          {termsError}
        </p>
      ) : null}
      <SubmitButton className="min-h-12 w-full text-base" pendingText={t.botonCargando}>
        {t.boton}
      </SubmitButton>
      <p className="text-center text-sm text-ink-muted">
        {t.yaTienesCuenta}{" "}
        <Link className="text-brand-700 hover:underline" href={loginHref}>
          {t.inicia}
        </Link>
      </p>
      <p className="border-t border-border pt-4 text-center text-sm text-ink-muted">
        {t.soloCita}{" "}
        <Link href="/buscar" className="font-medium text-brand-700 underline">
          {t.buscarClinica}
        </Link>
      </p>
    </form>
  );
}
