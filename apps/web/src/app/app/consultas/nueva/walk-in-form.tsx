"use client";

import { FormField, Input, Select, Textarea } from "@dogtoralia/ui";
import { useActionState, useState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { crearConsultaWalkIn } from "@/lib/clinica/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.consultas.nueva;

interface Props {
  clinicId: string;
  pacientes: { petId: string; ownerId: string; etiqueta: string }[];
  servicios: { id: string; nombre: string }[];
  veterinarios: { clinicMemberId: string; nombre: string }[];
}

export function WalkInForm({ clinicId, pacientes, servicios, veterinarios }: Props) {
  const [state, action] = useActionState(crearConsultaWalkIn, initialFormState);
  const [esUrgencia, setEsUrgencia] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinicId} />
      <FormAlerts state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="paciente"
          label={t.mascota}
          required
          error={primerError(state, "petId") ?? primerError(state, "ownerId")}
        >
          <Select id="paciente" name="paciente" defaultValue="" required>
            <option value="" disabled>
              —
            </option>
            {pacientes.map((p) => (
              <option key={p.petId} value={`${p.petId}|${p.ownerId}`}>
                {p.etiqueta}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          htmlFor="serviceIds"
          label={t.servicio}
          required
          error={primerError(state, "serviceIds")}
        >
          <Select id="serviceIds" name="serviceIds" defaultValue="" required>
            <option value="" disabled>
              —
            </option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          htmlFor="veterinarianMemberId"
          label={t.veterinario}
          required
          error={primerError(state, "veterinarianMemberId")}
        >
          <Select id="veterinarianMemberId" name="veterinarianMemberId" defaultValue="" required>
            <option value="" disabled>
              —
            </option>
            {veterinarios.map((v) => (
              <option key={v.clinicMemberId} value={v.clinicMemberId}>
                {v.nombre}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          htmlFor="encounterType"
          label={t.tipo}
          required
          error={primerError(state, "encounterType")}
        >
          <Select
            id="encounterType"
            name="encounterType"
            defaultValue="walk_in"
            onChange={(evento) => setEsUrgencia(evento.target.value === "emergency")}
          >
            <option value="walk_in">{t.tipoWalkIn}</option>
            <option value="emergency">{t.tipoUrgencia}</option>
          </Select>
        </FormField>
      </div>

      <FormField
        htmlFor="chiefComplaint"
        label={t.motivo}
        error={primerError(state, "chiefComplaint")}
      >
        <Textarea id="chiefComplaint" name="chiefComplaint" rows={2} />
      </FormField>

      {esUrgencia ? (
        <FormField
          htmlFor="emergencyReason"
          label={t.motivoUrgencia}
          error={primerError(state, "emergencyReason")}
        >
          <Input id="emergencyReason" name="emergencyReason" />
        </FormField>
      ) : null}

      <div>
        <SubmitButton pendingText={t.creando}>{t.crear}</SubmitButton>
      </div>
    </form>
  );
}
