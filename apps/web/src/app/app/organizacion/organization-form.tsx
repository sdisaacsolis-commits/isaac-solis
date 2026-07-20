"use client";

import { FormField, Input } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { actualizarOrganizacion } from "@/lib/tenancy/actions";

const t = mensajes.organizacion;

interface Props {
  organizationId: string;
  defaults: { name: string; slug: string; legalName: string; taxId: string };
}

export function OrganizationForm({ organizationId, defaults }: Props) {
  const [state, action] = useActionState(actualizarOrganizacion, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormAlerts state={state} />
      <FormField htmlFor="name" label={t.nombre} required error={primerError(state, "name")}>
        <Input id="name" name="name" defaultValue={defaults.name} required />
      </FormField>
      <FormField htmlFor="slug" label={t.slug} error={primerError(state, "slug")}>
        <Input id="slug" name="slug" defaultValue={defaults.slug} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="legalName"
          label={t.razonSocial}
          error={primerError(state, "legalName")}
        >
          <Input id="legalName" name="legalName" defaultValue={defaults.legalName} />
        </FormField>
        <FormField htmlFor="taxId" label={t.rfc} error={primerError(state, "taxId")}>
          <Input id="taxId" name="taxId" defaultValue={defaults.taxId} />
        </FormField>
      </div>
      <SubmitButton pendingText={mensajes.comun.guardando}>{mensajes.comun.guardar}</SubmitButton>
    </form>
  );
}
