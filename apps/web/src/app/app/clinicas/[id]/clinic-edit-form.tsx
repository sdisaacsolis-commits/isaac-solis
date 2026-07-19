"use client";

import type { Tables } from "@dogtoralia/types";
import { FormField, Input } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { actualizarClinica } from "@/lib/tenancy/actions";

const c = mensajes.clinicas.campos;

export function ClinicEditForm({ clinica }: { clinica: Tables<"clinics"> }) {
  const [state, action] = useActionState(actualizarClinica, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinica.id} />
      <FormAlerts state={state} />
      <FormField htmlFor="name" label={c.nombre} required error={primerError(state, "name")}>
        <Input id="name" name="name" defaultValue={clinica.name} required />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="slug" label={c.slug} error={primerError(state, "slug")}>
          <Input id="slug" name="slug" defaultValue={clinica.slug ?? ""} />
        </FormField>
        <FormField htmlFor="email" label={c.correo} error={primerError(state, "email")}>
          <Input id="email" name="email" type="email" defaultValue={clinica.email ?? ""} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="phone" label={c.telefono} error={primerError(state, "phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={clinica.phone ?? ""} />
        </FormField>
        <FormField htmlFor="timezone" label={c.zonaHoraria} error={primerError(state, "timezone")}>
          <Input id="timezone" name="timezone" defaultValue={clinica.timezone} />
        </FormField>
      </div>
      <FormField
        htmlFor="description"
        label={c.descripcion}
        error={primerError(state, "description")}
      >
        <Input id="description" name="description" defaultValue={clinica.description ?? ""} />
      </FormField>
      <FormField
        htmlFor="addressLine1"
        label={c.direccion}
        error={primerError(state, "addressLine1")}
      >
        <Input id="addressLine1" name="addressLine1" defaultValue={clinica.address_line_1 ?? ""} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="neighborhood"
          label={c.colonia}
          error={primerError(state, "neighborhood")}
        >
          <Input id="neighborhood" name="neighborhood" defaultValue={clinica.neighborhood ?? ""} />
        </FormField>
        <FormField htmlFor="city" label={c.ciudad} error={primerError(state, "city")}>
          <Input id="city" name="city" defaultValue={clinica.city ?? ""} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="state" label={c.estado} error={primerError(state, "state")}>
          <Input id="state" name="state" defaultValue={clinica.state ?? ""} />
        </FormField>
        <FormField htmlFor="postalCode" label={c.cp} error={primerError(state, "postalCode")}>
          <Input
            id="postalCode"
            name="postalCode"
            inputMode="numeric"
            defaultValue={clinica.postal_code ?? ""}
          />
        </FormField>
      </div>
      <SubmitButton pendingText={mensajes.comun.guardando}>{mensajes.comun.guardar}</SubmitButton>
    </form>
  );
}
