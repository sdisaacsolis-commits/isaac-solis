"use client";

import type { Tables } from "@dogtoralia/types";
import { PET_SPECIES } from "@dogtoralia/types";
import { FormField, Input } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie } from "@/lib/pets/format";
import { actualizarProductoCatalogo, guardarProductoCatalogo } from "@/lib/vacunacion/actions";

const t = mensajes.vacunacion.catalogo;

/** Alta o edición de un producto del catálogo (contenido NO prescriptivo). */
export function VacunaCatalogoForm({
  organizationId,
  producto,
}: {
  organizationId: string;
  producto?: Tables<"vaccines_catalog">;
}) {
  const [state, action] = useActionState(
    producto ? actualizarProductoCatalogo : guardarProductoCatalogo,
    initialFormState,
  );
  const prefijo = producto ? `vacuna-${producto.id}` : "vacuna-nueva";
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="organizationId" value={organizationId} />
      {producto ? <input type="hidden" name="catalogId" value={producto.id} /> : null}
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor={`${prefijo}-name`}
          label={t.nombre}
          required
          error={primerError(state, "name")}
        >
          <Input id={`${prefijo}-name`} name="name" required defaultValue={producto?.name ?? ""} />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-manufacturer`}
          label={t.fabricante}
          error={primerError(state, "manufacturer")}
        >
          <Input
            id={`${prefijo}-manufacturer`}
            name="manufacturer"
            defaultValue={producto?.manufacturer ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-presentation`}
          label={t.presentacion}
          error={primerError(state, "presentation")}
        >
          <Input
            id={`${prefijo}-presentation`}
            name="presentation"
            defaultValue={producto?.presentation ?? ""}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor={`${prefijo}-diseasesCovered`}
          label={t.enfermedades}
          error={primerError(state, "diseasesCovered")}
        >
          <Input
            id={`${prefijo}-diseasesCovered`}
            name="diseasesCovered"
            defaultValue={(producto?.diseases_covered ?? []).join(", ")}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-defaultBoosterIntervalDays`}
          label={t.intervalo}
          error={primerError(state, "defaultBoosterIntervalDays")}
        >
          <Input
            id={`${prefijo}-defaultBoosterIntervalDays`}
            name="defaultBoosterIntervalDays"
            type="number"
            min={1}
            max={3650}
            defaultValue={producto?.default_booster_interval_days ?? ""}
          />
        </FormField>
      </div>
      <p className="text-xs text-ink-muted">{t.pistaIntervalo}</p>
      <fieldset className="flex flex-wrap items-center gap-4">
        <legend className="mb-1 text-sm font-medium text-ink">{t.especies}</legend>
        {PET_SPECIES.map((especie) => (
          <span key={especie} className="flex items-center gap-2">
            <input
              id={`${prefijo}-especie-${especie}`}
              name="targetSpecies"
              value={especie}
              type="checkbox"
              defaultChecked={producto?.target_species.includes(especie) ?? false}
              className="h-4 w-4 rounded border-border accent-brand-600"
            />
            <label htmlFor={`${prefijo}-especie-${especie}`} className="text-sm text-ink">
              {etiquetasEspecie[especie]}
            </label>
          </span>
        ))}
      </fieldset>
      <div className="flex items-center gap-2">
        <input
          id={`${prefijo}-active`}
          name="active"
          type="checkbox"
          defaultChecked={producto?.active ?? true}
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor={`${prefijo}-active`} className="text-sm text-ink">
          {t.activo}
        </label>
      </div>
      <div>
        <SubmitButton variant={producto ? "outline" : "primary"} pendingText={t.guardando}>
          {t.guardar}
        </SubmitButton>
      </div>
    </form>
  );
}
