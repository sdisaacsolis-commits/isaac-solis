"use client";

import { FormField, Input } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { crearClinica } from "@/lib/tenancy/actions";

const t = mensajes.onboarding.clinica;

export function ClinicStep({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(crearClinica, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormAlerts state={state} />
      <FormField htmlFor="name" label={t.nombre} required error={primerError(state, "name")}>
        <Input id="name" name="name" required />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="slug" label={t.slug} error={primerError(state, "slug")}>
          <Input id="slug" name="slug" placeholder="clinica-luna-centro" />
        </FormField>
        <FormField htmlFor="email" label={t.correo} error={primerError(state, "email")}>
          <Input id="email" name="email" type="email" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="phone" label={t.telefono} error={primerError(state, "phone")}>
          <Input id="phone" name="phone" type="tel" placeholder="+52 55 0000 0000" />
        </FormField>
        <FormField htmlFor="timezone" label={t.zonaHoraria} error={primerError(state, "timezone")}>
          <Input id="timezone" name="timezone" defaultValue="America/Mexico_City" required />
        </FormField>
      </div>
      <FormField
        htmlFor="addressLine1"
        label={t.direccion}
        error={primerError(state, "addressLine1")}
      >
        <Input id="addressLine1" name="addressLine1" autoComplete="street-address" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="neighborhood"
          label={t.colonia}
          error={primerError(state, "neighborhood")}
        >
          <Input id="neighborhood" name="neighborhood" />
        </FormField>
        <FormField htmlFor="city" label={t.ciudad} error={primerError(state, "city")}>
          <Input id="city" name="city" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="state" label={t.estado} error={primerError(state, "state")}>
          <Input id="state" name="state" />
        </FormField>
        <FormField htmlFor="postalCode" label={t.cp} error={primerError(state, "postalCode")}>
          <Input id="postalCode" name="postalCode" inputMode="numeric" placeholder="06600" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="currency" label={t.moneda}>
          <Input id="currency" name="currencyDisplay" value="MXN" disabled readOnly />
        </FormField>
        <FormField htmlFor="country" label={t.pais}>
          <Input id="country" name="countryDisplay" value="México (MX)" disabled readOnly />
        </FormField>
      </div>
      <SubmitButton pendingText={mensajes.comun.guardando}>{t.crear}</SubmitButton>
    </form>
  );
}
