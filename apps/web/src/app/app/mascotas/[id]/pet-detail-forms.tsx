"use client";

import {
  OWNER_PET_RELATIONSHIP_TYPES,
  PET_ALERT_SEVERITIES,
  PET_ALERT_TYPES,
} from "@dogtoralia/types";
import { FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { agregarPropietarioMascota, crearAlerta } from "@/lib/pets/actions";
import {
  etiquetasRelacionPropietario,
  etiquetasSeveridadAlerta,
  etiquetasTipoAlerta,
} from "@/lib/pets/format";

const inicial: FormState = { ok: false };

export function AddOwnerForm({
  petId,
  propietarios,
}: {
  petId: string;
  propietarios: { id: string; nombre: string }[];
}) {
  const [state, action] = useActionState(agregarPropietarioMascota, inicial);
  const t = mensajes.pacientes.mascotas;

  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="petId" value={petId} />
      <FormField
        htmlFor="ownerId"
        label={t.agregarPropietario}
        error={primerError(state, "ownerId")}
        className="min-w-56 flex-1"
      >
        <Select id="ownerId" name="ownerId" defaultValue="" required>
          <option value="" disabled>
            —
          </option>
          {propietarios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        htmlFor="relationshipType"
        label={t.campos.relacion}
        error={primerError(state, "relationshipType")}
        className="min-w-44"
      >
        <Select id="relationshipType" name="relationshipType" defaultValue="family_member">
          {OWNER_PET_RELATIONSHIP_TYPES.map((tipo) => (
            <option key={tipo} value={tipo}>
              {etiquetasRelacionPropietario[tipo]}
            </option>
          ))}
        </Select>
      </FormField>
      <SubmitButton pendingText={mensajes.comun.guardando} variant="outline">
        {t.agregarPropietario}
      </SubmitButton>
      <div className="w-full">
        <FormAlerts state={state} />
      </div>
    </form>
  );
}

export function AlertForm({ petId, clinicId }: { petId: string; clinicId: string }) {
  const [state, action] = useActionState(crearAlerta, inicial);
  const t = mensajes.pacientes.alertas;

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="petId" value={petId} />
      <input type="hidden" name="clinicId" value={clinicId} />
      <FormAlerts state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField htmlFor="type" label={t.tipo} error={primerError(state, "type")}>
          <Select id="type" name="type" defaultValue="handling_precaution">
            {PET_ALERT_TYPES.map((tipo) => (
              <option key={tipo} value={tipo}>
                {etiquetasTipoAlerta[tipo]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="severity" label={t.severidad} error={primerError(state, "severity")}>
          <Select id="severity" name="severity" defaultValue="caution">
            {PET_ALERT_SEVERITIES.map((sev) => (
              <option key={sev} value={sev}>
                {etiquetasSeveridadAlerta[sev]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="title" label={t.titulo} required error={primerError(state, "title")}>
          <Input id="title" name="title" required />
        </FormField>
      </div>
      <FormField
        htmlFor="description"
        label={t.descripcion}
        error={primerError(state, "description")}
      >
        <Input id="description" name="description" />
      </FormField>
      <SubmitButton pendingText={mensajes.comun.guardando} variant="outline">
        {mensajes.pacientes.mascotas.nuevaAlerta}
      </SubmitButton>
    </form>
  );
}
