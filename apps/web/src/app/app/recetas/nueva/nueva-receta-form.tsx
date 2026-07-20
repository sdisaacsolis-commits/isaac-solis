"use client";

import { FormField, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { crearBorradorReceta } from "@/lib/recetas/actions";
import type { ConsultaParaReceta } from "@/lib/recetas/queries";

const t = mensajes.recetas.seleccion;

/** Selector de consulta finalizada; crea el borrador y redirige al editor. */
export function NuevaRecetaForm({
  consultas,
  preseleccionada,
}: {
  consultas: ConsultaParaReceta[];
  preseleccionada?: string;
}) {
  const [state, action] = useActionState(crearBorradorReceta, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlerts state={state} />
      <FormField
        htmlFor="encounterId"
        label={t.consulta}
        required
        error={primerError(state, "encounterId")}
      >
        <Select
          id="encounterId"
          name="encounterId"
          required
          defaultValue={preseleccionada ?? consultas[0]?.id ?? ""}
        >
          {consultas.map((consulta) => (
            <option key={consulta.id} value={consulta.id}>
              {consulta.folio} — {consulta.mascota}
            </option>
          ))}
        </Select>
      </FormField>
      <p className="text-xs text-ink-muted">{t.soloVeterinario}</p>
      <div>
        <SubmitButton pendingText={t.creando}>{t.crear}</SubmitButton>
      </div>
    </form>
  );
}
