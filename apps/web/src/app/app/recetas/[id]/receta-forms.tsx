"use client";

import type { Tables } from "@dogtoralia/types";
import { FormField, Input, Textarea } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import {
  actualizarBorradorReceta,
  actualizarPartida,
  agregarPartida,
  anularReceta,
  descartarBorrador,
  emitirReceta,
  sustituirReceta,
} from "@/lib/recetas/actions";

const t = mensajes.recetas.detalle;

/** Encabezado del borrador con control optimista de versión (hidden expectedVersion). */
export function EncabezadoRecetaForm({
  receta,
}: {
  receta: Pick<
    Tables<"prescriptions">,
    "id" | "version" | "general_instructions" | "clinical_indication" | "valid_until"
  >;
}) {
  const [state, action] = useActionState(actualizarBorradorReceta, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="prescriptionId" value={receta.id} />
      <input type="hidden" name="expectedVersion" value={receta.version} />
      <FormAlerts state={state} />
      <FormField
        htmlFor="generalInstructions"
        label={t.instruccionesGenerales}
        error={primerError(state, "generalInstructions")}
      >
        <Textarea
          id="generalInstructions"
          name="generalInstructions"
          rows={2}
          defaultValue={receta.general_instructions ?? ""}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="clinicalIndication"
          label={t.indicacionClinica}
          error={primerError(state, "clinicalIndication")}
        >
          <Input
            id="clinicalIndication"
            name="clinicalIndication"
            defaultValue={receta.clinical_indication ?? ""}
          />
        </FormField>
        <FormField htmlFor="validUntil" label={t.vigencia} error={primerError(state, "validUntil")}>
          <Input
            id="validUntil"
            name="validUntil"
            type="date"
            defaultValue={receta.valid_until ?? ""}
          />
        </FormField>
      </div>
      <div>
        <SubmitButton variant="outline" pendingText={mensajes.comun.guardando}>
          {t.guardarEncabezado}
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Alta o edición de una partida. Todo el contenido clínico (dosis, vía,
 * frecuencia, duración) es texto capturado por el veterinario: Dogtoralia no
 * calcula, sugiere ni autocompleta nada.
 */
export function PartidaForm({
  prescriptionId,
  partida,
  posicionSugerida,
}: {
  prescriptionId: string;
  partida?: Tables<"prescription_items">;
  posicionSugerida?: number;
}) {
  const [state, action] = useActionState(
    partida ? actualizarPartida : agregarPartida,
    initialFormState,
  );
  const prefijo = partida ? `partida-${partida.id}` : "partida-nueva";
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
      {partida ? <input type="hidden" name="itemId" value={partida.id} /> : null}
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor={`${prefijo}-medicationName`}
          label={t.medicamento}
          required
          error={primerError(state, "medicationName")}
        >
          <Input
            id={`${prefijo}-medicationName`}
            name="medicationName"
            required
            defaultValue={partida?.medication_name ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-activeIngredient`}
          label={t.principioActivo}
          error={primerError(state, "activeIngredient")}
        >
          <Input
            id={`${prefijo}-activeIngredient`}
            name="activeIngredient"
            defaultValue={partida?.active_ingredient ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-position`}
          label={t.orden}
          error={primerError(state, "position")}
        >
          <Input
            id={`${prefijo}-position`}
            name="position"
            type="number"
            min={1}
            max={200}
            defaultValue={partida?.position ?? posicionSugerida ?? 1}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor={`${prefijo}-presentation`}
          label={t.presentacion}
          error={primerError(state, "presentation")}
        >
          <Input
            id={`${prefijo}-presentation`}
            name="presentation"
            defaultValue={partida?.presentation ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-concentration`}
          label={t.concentracion}
          error={primerError(state, "concentration")}
        >
          <Input
            id={`${prefijo}-concentration`}
            name="concentration"
            defaultValue={partida?.concentration ?? ""}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField
          htmlFor={`${prefijo}-dosageText`}
          label={t.dosis}
          required
          error={primerError(state, "dosageText")}
        >
          <Input
            id={`${prefijo}-dosageText`}
            name="dosageText"
            required
            defaultValue={partida?.dosage_text ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-routeText`}
          label={t.via}
          required
          error={primerError(state, "routeText")}
        >
          <Input
            id={`${prefijo}-routeText`}
            name="routeText"
            required
            defaultValue={partida?.route_text ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-frequencyText`}
          label={t.frecuencia}
          required
          error={primerError(state, "frequencyText")}
        >
          <Input
            id={`${prefijo}-frequencyText`}
            name="frequencyText"
            required
            defaultValue={partida?.frequency_text ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-durationText`}
          label={t.duracion}
          required
          error={primerError(state, "durationText")}
        >
          <Input
            id={`${prefijo}-durationText`}
            name="durationText"
            required
            defaultValue={partida?.duration_text ?? ""}
          />
        </FormField>
      </div>
      <FormField
        htmlFor={`${prefijo}-instructions`}
        label={t.indicaciones}
        error={primerError(state, "instructions")}
      >
        <Textarea
          id={`${prefijo}-instructions`}
          name="instructions"
          rows={2}
          defaultValue={partida?.instructions ?? ""}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField
          htmlFor={`${prefijo}-quantityText`}
          label={t.cantidad}
          error={primerError(state, "quantityText")}
        >
          <Input
            id={`${prefijo}-quantityText`}
            name="quantityText"
            defaultValue={partida?.quantity_text ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-startDate`}
          label={t.inicioTratamiento}
          error={primerError(state, "startDate")}
        >
          <Input
            id={`${prefijo}-startDate`}
            name="startDate"
            type="date"
            defaultValue={partida?.start_date ?? ""}
          />
        </FormField>
        <FormField
          htmlFor={`${prefijo}-endDate`}
          label={t.finTratamiento}
          error={primerError(state, "endDate")}
        >
          <Input
            id={`${prefijo}-endDate`}
            name="endDate"
            type="date"
            defaultValue={partida?.end_date ?? ""}
          />
        </FormField>
        <FormField htmlFor={`${prefijo}-notes`} label={t.notas} error={primerError(state, "notes")}>
          <Input id={`${prefijo}-notes`} name="notes" defaultValue={partida?.notes ?? ""} />
        </FormField>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`${prefijo}-asNeeded`}
          name="asNeeded"
          type="checkbox"
          defaultChecked={partida?.as_needed ?? false}
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor={`${prefijo}-asNeeded`} className="text-sm text-ink">
          {t.prn}
        </label>
      </div>
      <div>
        <SubmitButton
          variant={partida ? "outline" : "primary"}
          pendingText={mensajes.comun.guardando}
        >
          {partida ? t.guardarPartida : t.agregarPartida}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Emisión con confirmación explícita: congela folio, snapshots y documento. */
export function EmitirRecetaForm({ prescriptionId }: { prescriptionId: string }) {
  const [state, action] = useActionState(emitirReceta, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(evento) => {
        if (!window.confirm(t.confirmarEmitir)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
      <input type="hidden" name="confirm" value="true" />
      <FormAlerts state={state} />
      <div>
        <SubmitButton pendingText={t.emitiendo}>{t.emitir}</SubmitButton>
      </div>
    </form>
  );
}

/** Descarte del borrador (borrado lógico, solo el prescriptor). */
export function DescartarBorradorForm({ prescriptionId }: { prescriptionId: string }) {
  const [state, action] = useActionState(descartarBorrador, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(evento) => {
        if (!window.confirm(t.confirmarDescartar)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
      <FormAlerts state={state} />
      <div>
        <SubmitButton variant="ghost" pendingText={t.descartando}>
          {t.descartar}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Sustitución con motivo obligatorio: crea un nuevo borrador con el contenido copiado. */
export function SustituirRecetaForm({ prescriptionId }: { prescriptionId: string }) {
  const [state, action] = useActionState(sustituirReceta, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(evento) => {
        if (!window.confirm(t.confirmarSustituir)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
      <FormAlerts state={state} />
      <FormField
        htmlFor="supersede-reason"
        label={t.motivoSustitucion}
        required
        error={primerError(state, "reason")}
      >
        <Input id="supersede-reason" name="reason" required />
      </FormField>
      <div>
        <SubmitButton variant="outline" pendingText={t.sustituyendo}>
          {t.sustituir}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Anulación administrativa con motivo obligatorio y confirmación. */
export function AnularRecetaForm({ prescriptionId }: { prescriptionId: string }) {
  const [state, action] = useActionState(anularReceta, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(evento) => {
        if (!window.confirm(t.confirmarAnular)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
      <FormAlerts state={state} />
      <FormField
        htmlFor="void-reason"
        label={t.motivoAnulacion}
        required
        error={primerError(state, "reason")}
      >
        <Input id="void-reason" name="reason" required />
      </FormField>
      <p className="text-xs text-ink-muted">{t.soloAdminAnula}</p>
      <div>
        <SubmitButton variant="destructive" pendingText={t.anulando}>
          {t.anular}
        </SubmitButton>
      </div>
    </form>
  );
}
