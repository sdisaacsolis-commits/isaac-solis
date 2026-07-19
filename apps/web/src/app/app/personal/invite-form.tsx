"use client";

import { CLINIC_ROLES } from "@dogtoralia/types";
import { FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasRolClinica } from "@/lib/roles";
import { invitarPersonal } from "@/lib/tenancy/actions";

const t = mensajes.personal.invitaciones;

interface Props {
  clinicas: { id: string; name: string }[];
  clinicaActivaId?: string;
}

export function InviteForm({ clinicas, clinicaActivaId }: Props) {
  const [state, action] = useActionState(invitarPersonal, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="clinicId"
          label={t.clinica}
          required
          error={primerError(state, "clinicId")}
        >
          <Select id="clinicId" name="clinicId" defaultValue={clinicaActivaId} required>
            {clinicas.map((clinica) => (
              <option key={clinica.id} value={clinica.id}>
                {clinica.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="role" label={t.rol} required error={primerError(state, "role")}>
          <Select id="role" name="role" defaultValue="receptionist" required>
            {CLINIC_ROLES.map((rol) => (
              <option key={rol} value={rol}>
                {etiquetasRolClinica[rol]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField htmlFor="email" label={t.correo} required error={primerError(state, "email")}>
        <Input id="email" name="email" type="email" required />
      </FormField>
      <FormField
        htmlFor="inviteeName"
        label={t.nombreOpcional}
        hint={t.pistaNombre}
        error={primerError(state, "inviteeName")}
      >
        <Input id="inviteeName" name="inviteeName" />
      </FormField>
      <SubmitButton pendingText={t.enviando}>{t.enviar}</SubmitButton>
    </form>
  );
}
