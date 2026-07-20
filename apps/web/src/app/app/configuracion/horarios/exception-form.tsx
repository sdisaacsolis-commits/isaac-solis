"use client";

import { SCHEDULE_EXCEPTION_TYPES } from "@dogtoralia/types";
import { FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { crearExcepcion } from "@/lib/agenda/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.horarios;

interface Props {
  clinicId: string;
  veterinarios: { clinicMemberId: string; nombre: string }[];
}

export function ExceptionForm({ clinicId, veterinarios }: Props) {
  const [state, action] = useActionState(crearExcepcion, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinicId} />
      <FormAlerts state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="exc-member"
          label={t.elegirVeterinario}
          error={primerError(state, "clinicMemberId")}
        >
          <Select id="exc-member" name="clinicMemberId" defaultValue="">
            <option value="">{t.todaLaClinica}</option>
            {veterinarios.map((veterinario) => (
              <option key={veterinario.clinicMemberId} value={veterinario.clinicMemberId}>
                {veterinario.nombre}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="exc-type" label={t.tipo} required error={primerError(state, "type")}>
          <Select id="exc-type" name="type" defaultValue="vacation" required>
            {SCHEDULE_EXCEPTION_TYPES.map((tipo) => (
              <option key={tipo} value={tipo}>
                {t.tipos[tipo] ?? tipo}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="exc-start"
          label={t.desde}
          required
          error={primerError(state, "startsAt")}
        >
          <Input id="exc-start" name="startsAt" type="datetime-local" required />
        </FormField>
        <FormField htmlFor="exc-end" label={t.hasta} required error={primerError(state, "endsAt")}>
          <Input id="exc-end" name="endsAt" type="datetime-local" required />
        </FormField>
      </div>

      <FormField htmlFor="exc-reason" label={t.motivo} error={primerError(state, "reason")}>
        <Input id="exc-reason" name="reason" />
      </FormField>

      <SubmitButton pendingText={t.guardando}>{t.registrar}</SubmitButton>
    </form>
  );
}
