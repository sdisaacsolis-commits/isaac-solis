"use client";

import { FormField, Input } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { crearOrganizacion } from "@/lib/tenancy/actions";

const t = mensajes.onboarding.organizacion;

export function OrganizationStep() {
  const [state, action] = useActionState(crearOrganizacion, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlerts state={state} />
      <FormField htmlFor="name" label={t.nombre} required error={primerError(state, "name")}>
        <Input id="name" name="name" required />
      </FormField>
      <FormField
        htmlFor="slug"
        label={t.slug}
        hint={t.pistaSlug}
        error={primerError(state, "slug")}
      >
        <Input id="slug" name="slug" placeholder="veterinaria-luna" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="legalName"
          label={t.razonSocial}
          error={primerError(state, "legalName")}
        >
          <Input id="legalName" name="legalName" />
        </FormField>
        <FormField htmlFor="taxId" label={t.rfc} error={primerError(state, "taxId")}>
          <Input id="taxId" name="taxId" placeholder="VLU240101AB1" />
        </FormField>
      </div>
      <SubmitButton pendingText={mensajes.comun.guardando}>{t.crear}</SubmitButton>
    </form>
  );
}
