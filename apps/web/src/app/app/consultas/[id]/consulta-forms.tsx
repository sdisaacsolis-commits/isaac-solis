"use client";

import type { Tables } from "@dogtoralia/types";
import { CLINICAL_FILE_KINDS, DIAGNOSIS_CERTAINTIES, TREATMENT_TYPES } from "@dogtoralia/types";
import { FormField, Input, Select, Textarea } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  agregarDiagnostico,
  agregarSeguimiento,
  agregarTratamiento,
  anularConsulta,
  crearAdenda,
  finalizarConsulta,
  guardarCabecera,
  guardarExploracion,
  guardarNota,
  registrarVitales,
  subirArchivoClinico,
} from "@/lib/clinica/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.consultas.detalle;

/** Motivo, justificaciones de omisión y notas internas (cabecera editable). */
export function CabeceraForm({
  encounterId,
  consulta,
}: {
  encounterId: string;
  consulta: Pick<
    Tables<"clinical_encounters">,
    "chief_complaint" | "vitals_skipped_reason" | "examination_skipped_reason" | "internal_notes"
  >;
}) {
  const [state, action] = useActionState(guardarCabecera, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      <FormAlerts state={state} />
      <FormField
        htmlFor="chiefComplaint"
        label={t.motivo}
        error={primerError(state, "chiefComplaint")}
      >
        <Textarea
          id="chiefComplaint"
          name="chiefComplaint"
          rows={2}
          defaultValue={consulta.chief_complaint ?? ""}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="vitalsSkippedReason"
          label={t.motivoOmitirVitales}
          error={primerError(state, "vitalsSkippedReason")}
        >
          <Input
            id="vitalsSkippedReason"
            name="vitalsSkippedReason"
            defaultValue={consulta.vitals_skipped_reason ?? ""}
          />
        </FormField>
        <FormField
          htmlFor="examinationSkippedReason"
          label={t.motivoOmitirExploracion}
          error={primerError(state, "examinationSkippedReason")}
        >
          <Input
            id="examinationSkippedReason"
            name="examinationSkippedReason"
            defaultValue={consulta.examination_skipped_reason ?? ""}
          />
        </FormField>
      </div>
      <FormField
        htmlFor="internalNotes"
        label={t.notasInternas}
        error={primerError(state, "internalNotes")}
      >
        <Textarea
          id="internalNotes"
          name="internalNotes"
          rows={2}
          defaultValue={consulta.internal_notes ?? ""}
        />
      </FormField>
      <div>
        <SubmitButton variant="outline" pendingText={mensajes.comun.guardando}>
          {t.guardarCabecera}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Nota SOAP con control optimista de versión (hidden expectedVersion). */
export function NotaForm({
  encounterId,
  nota,
}: {
  encounterId: string;
  nota: Tables<"clinical_notes"> | null;
}) {
  const [state, action] = useActionState(guardarNota, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      {nota ? <input type="hidden" name="expectedVersion" value={nota.version} /> : null}
      <FormAlerts state={state} />
      <FormField
        htmlFor="historySummary"
        label={t.antecedentes}
        error={primerError(state, "historySummary")}
      >
        <Textarea
          id="historySummary"
          name="historySummary"
          rows={2}
          defaultValue={nota?.history_summary ?? ""}
        />
      </FormField>
      <FormField htmlFor="subjective" label={t.subjetivo} error={primerError(state, "subjective")}>
        <Textarea id="subjective" name="subjective" defaultValue={nota?.subjective ?? ""} />
      </FormField>
      <FormField htmlFor="objective" label={t.objetivo} error={primerError(state, "objective")}>
        <Textarea id="objective" name="objective" defaultValue={nota?.objective ?? ""} />
      </FormField>
      <FormField htmlFor="assessment" label={t.evaluacion} error={primerError(state, "assessment")}>
        <Textarea id="assessment" name="assessment" defaultValue={nota?.assessment ?? ""} />
      </FormField>
      <FormField htmlFor="plan" label={t.plan} error={primerError(state, "plan")}>
        <Textarea id="plan" name="plan" defaultValue={nota?.plan ?? ""} />
      </FormField>
      <div>
        <SubmitButton pendingText={mensajes.comun.guardando}>{t.guardarNota}</SubmitButton>
      </div>
    </form>
  );
}

/** Alta de una medición de signos vitales (append-only). */
export function VitalesForm({ encounterId }: { encounterId: string }) {
  const [state, action] = useActionState(registrarVitales, initialFormState);
  const campos: [string, string, string][] = [
    ["weightKg", t.vitalPeso, "0.001"],
    ["temperatureC", t.vitalTemperatura, "0.1"],
    ["heartRateBpm", t.vitalFrecuenciaCardiaca, "1"],
    ["respiratoryRateBpm", t.vitalFrecuenciaRespiratoria, "1"],
    ["capillaryRefillSeconds", t.vitalLlenadoCapilar, "0.1"],
    ["bodyConditionScore", t.vitalCondicionCorporal, "1"],
    ["painScore", t.vitalDolor, "1"],
    ["bloodPressureSystolic", t.vitalPresionSistolica, "1"],
    ["bloodPressureDiastolic", t.vitalPresionDiastolica, "1"],
  ];
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        {campos.map(([nombre, etiqueta, paso]) => (
          <FormField
            key={nombre}
            htmlFor={`vital-${nombre}`}
            label={etiqueta}
            error={primerError(state, nombre)}
          >
            <Input
              id={`vital-${nombre}`}
              name={nombre}
              type="number"
              step={paso}
              inputMode="decimal"
            />
          </FormField>
        ))}
        <FormField
          htmlFor="vital-hydrationStatus"
          label={t.vitalHidratacion}
          error={primerError(state, "hydrationStatus")}
        >
          <Input id="vital-hydrationStatus" name="hydrationStatus" />
        </FormField>
        <FormField
          htmlFor="vital-mucousMembranes"
          label={t.vitalMucosas}
          error={primerError(state, "mucousMembranes")}
        >
          <Input id="vital-mucousMembranes" name="mucousMembranes" />
        </FormField>
        <FormField htmlFor="vital-notes" label={t.vitalNotas} error={primerError(state, "notes")}>
          <Input id="vital-notes" name="notes" />
        </FormField>
      </div>
      <div>
        <SubmitButton variant="outline" pendingText={mensajes.comun.guardando}>
          {t.registrarVitales}
        </SubmitButton>
      </div>
    </form>
  );
}

const CAMPOS_EXPLORACION: [keyof Tables<"encounter_examinations">, string, string][] = [
  ["general_condition", "generalCondition", t.expEstadoGeneral],
  ["attitude", "attitude", t.expActitud],
  ["body_condition", "bodyCondition", t.expCondicionCorporal],
  ["skin_and_coat", "skinAndCoat", t.expPielYPelaje],
  ["eyes", "eyes", t.expOjos],
  ["ears", "ears", t.expOidos],
  ["oral_cavity", "oralCavity", t.expCavidadOral],
  ["cardiovascular", "cardiovascular", t.expCardiovascular],
  ["respiratory", "respiratory", t.expRespiratorio],
  ["digestive", "digestive", t.expDigestivo],
  ["urinary", "urinary", t.expUrinario],
  ["musculoskeletal", "musculoskeletal", t.expMusculoesqueletico],
  ["neurological", "neurological", t.expNeurologico],
  ["lymph_nodes", "lymphNodes", t.expGanglios],
];

/** Exploración física por sistemas, con control optimista de versión. */
export function ExploracionForm({
  encounterId,
  exploracion,
}: {
  encounterId: string;
  exploracion: Tables<"encounter_examinations"> | null;
}) {
  const [state, action] = useActionState(guardarExploracion, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      {exploracion ? (
        <input type="hidden" name="expectedVersion" value={exploracion.version} />
      ) : null}
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_EXPLORACION.map(([columna, nombre, etiqueta]) => (
          <FormField
            key={nombre}
            htmlFor={`exp-${nombre}`}
            label={etiqueta}
            error={primerError(state, nombre)}
          >
            <Input
              id={`exp-${nombre}`}
              name={nombre}
              defaultValue={(exploracion?.[columna] as string | null) ?? ""}
            />
          </FormField>
        ))}
      </div>
      <FormField
        htmlFor="exp-observations"
        label={t.expObservaciones}
        error={primerError(state, "observations")}
      >
        <Textarea
          id="exp-observations"
          name="observations"
          defaultValue={exploracion?.observations ?? ""}
        />
      </FormField>
      <div>
        <SubmitButton pendingText={mensajes.comun.guardando}>{t.guardarExploracion}</SubmitButton>
      </div>
    </form>
  );
}

export function DiagnosticoForm({ encounterId }: { encounterId: string }) {
  const [state, action] = useActionState(agregarDiagnostico, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="dx-name"
          label={t.diagnostico}
          required
          error={primerError(state, "name")}
        >
          <Input id="dx-name" name="name" required />
        </FormField>
        <FormField htmlFor="dx-certainty" label={t.certeza} error={primerError(state, "certainty")}>
          <Select id="dx-certainty" name="certainty" defaultValue="presumptive">
            {DIAGNOSIS_CERTAINTIES.map((certeza) => (
              <option key={certeza} value={certeza}>
                {mensajes.consultas.certezas[certeza] ?? certeza}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        htmlFor="dx-description"
        label={t.diagnosticoDescripcion}
        error={primerError(state, "description")}
      >
        <Input id="dx-description" name="description" />
      </FormField>
      <div className="flex items-center gap-2">
        <input
          id="dx-isPrimary"
          name="isPrimary"
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="dx-isPrimary" className="text-sm text-ink">
          {t.esPrincipal}
        </label>
      </div>
      <div>
        <SubmitButton variant="outline" pendingText={mensajes.comun.guardando}>
          {t.agregarDiagnostico}
        </SubmitButton>
      </div>
    </form>
  );
}

export function TratamientoForm({ encounterId }: { encounterId: string }) {
  const [state, action] = useActionState(agregarTratamiento, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="tx-name"
          label={t.tratamiento}
          required
          error={primerError(state, "name")}
        >
          <Input id="tx-name" name="name" required />
        </FormField>
        <FormField
          htmlFor="tx-type"
          label={t.tipoTratamiento}
          error={primerError(state, "treatmentType")}
        >
          <Select id="tx-type" name="treatmentType" defaultValue="medication_recommendation">
            {TREATMENT_TYPES.map((tipo) => (
              <option key={tipo} value={tipo}>
                {mensajes.consultas.tiposTratamiento[tipo] ?? tipo}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        htmlFor="tx-instructions"
        label={t.indicaciones}
        error={primerError(state, "instructions")}
      >
        <Textarea id="tx-instructions" name="instructions" rows={2} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField htmlFor="tx-dosage" label={t.dosis} error={primerError(state, "dosageText")}>
          <Input id="tx-dosage" name="dosageText" />
        </FormField>
        <FormField htmlFor="tx-route" label={t.via} error={primerError(state, "routeText")}>
          <Input id="tx-route" name="routeText" />
        </FormField>
        <FormField
          htmlFor="tx-frequency"
          label={t.frecuencia}
          error={primerError(state, "frequencyText")}
        >
          <Input id="tx-frequency" name="frequencyText" />
        </FormField>
        <FormField
          htmlFor="tx-duration"
          label={t.duracion}
          error={primerError(state, "durationText")}
        >
          <Input id="tx-duration" name="durationText" />
        </FormField>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="tx-performed"
          name="performedDuringEncounter"
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="tx-performed" className="text-sm text-ink">
          {t.aplicadoEnConsulta}
        </label>
      </div>
      <div>
        <SubmitButton variant="outline" pendingText={mensajes.comun.guardando}>
          {t.agregarTratamiento}
        </SubmitButton>
      </div>
    </form>
  );
}

export function SeguimientoForm({
  encounterId,
  servicios,
}: {
  encounterId: string;
  servicios: { id: string; nombre: string }[];
}) {
  const [state, action] = useActionState(agregarSeguimiento, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="fu-reason"
          label={t.motivoSeguimiento}
          required
          error={primerError(state, "reason")}
        >
          <Input id="fu-reason" name="reason" required />
        </FormField>
        <FormField
          htmlFor="fu-days"
          label={t.dentroDeDias}
          error={primerError(state, "recommendedWithinDays")}
        >
          <Input id="fu-days" name="recommendedWithinDays" type="number" min={1} max={365} />
        </FormField>
        <FormField
          htmlFor="fu-service"
          label={t.servicioSugerido}
          error={primerError(state, "serviceId")}
        >
          <Select id="fu-service" name="serviceId" defaultValue="">
            <option value="">—</option>
            {servicios.map((servicio) => (
              <option key={servicio.id} value={servicio.id}>
                {servicio.nombre}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div>
        <SubmitButton variant="outline" pendingText={mensajes.comun.guardando}>
          {t.agregarSeguimiento}
        </SubmitButton>
      </div>
    </form>
  );
}

export function ArchivoForm({ encounterId }: { encounterId: string }) {
  const [state, action] = useActionState(subirArchivoClinico, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField htmlFor="file" label={t.archivo} required>
          <Input
            id="file"
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            required
            className="pt-1.5"
          />
        </FormField>
        <FormField htmlFor="file-kind" label={t.tipoArchivo} error={primerError(state, "kind")}>
          <Select id="file-kind" name="kind" defaultValue="other">
            {CLINICAL_FILE_KINDS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {mensajes.consultas.tiposArchivo[tipo] ?? tipo}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          htmlFor="file-description"
          label={t.descripcionArchivo}
          error={primerError(state, "description")}
        >
          <Input id="file-description" name="description" />
        </FormField>
      </div>
      <div>
        <SubmitButton variant="outline" pendingText={t.subiendo}>
          {t.subirArchivo}
        </SubmitButton>
      </div>
    </form>
  );
}

export function AdendaForm({ encounterId }: { encounterId: string }) {
  const [state, action] = useActionState(crearAdenda, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="encounterId" value={encounterId} />
      <FormAlerts state={state} />
      <FormField
        htmlFor="addendum-content"
        label={t.adendaContenido}
        required
        error={primerError(state, "content")}
      >
        <Textarea id="addendum-content" name="content" required />
      </FormField>
      <FormField
        htmlFor="addendum-reason"
        label={t.adendaMotivo}
        required
        error={primerError(state, "reason")}
      >
        <Input id="addendum-reason" name="reason" required />
      </FormField>
      <div>
        <SubmitButton variant="outline" pendingText={mensajes.comun.guardando}>
          {t.agregarAdenda}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Cierre de la consulta con confirmación (el expediente queda inmutable). */
export function FinalizarForm({ encounterId }: { encounterId: string }) {
  const [state, action] = useActionState(finalizarConsulta, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(evento) => {
        if (!window.confirm(t.confirmarFinalizar)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="encounterId" value={encounterId} />
      <FormAlerts state={state} />
      <div>
        <SubmitButton pendingText={t.finalizando}>{t.finalizar}</SubmitButton>
      </div>
    </form>
  );
}

/** Anulación administrativa con motivo obligatorio y confirmación. */
export function AnularForm({ encounterId }: { encounterId: string }) {
  const [state, action] = useActionState(anularConsulta, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(evento) => {
        if (!window.confirm(t.confirmarAnular)) evento.preventDefault();
      }}
    >
      <input type="hidden" name="encounterId" value={encounterId} />
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
