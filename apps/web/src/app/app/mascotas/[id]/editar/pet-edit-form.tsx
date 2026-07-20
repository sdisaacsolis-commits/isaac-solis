"use client";

import { PET_SEXES, PET_SPECIES, type Tables } from "@dogtoralia/types";
import { FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { mensajes } from "@/lib/i18n/es-mx";
import { actualizarMascota, type PacienteFormState } from "@/lib/pets/actions";
import { etiquetasEspecie, etiquetasSexo } from "@/lib/pets/format";

const t = mensajes.pacientes.mascotas;
const inicial: PacienteFormState = { ok: false };

export function PetEditForm({ mascota }: { mascota: Tables<"pets"> }) {
  const [state, action] = useActionState(actualizarMascota, inicial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="petId" value={mascota.id} />
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="name"
          label={t.campos.nombre}
          required
          error={primerError(state, "name")}
        >
          <Input id="name" name="name" defaultValue={mascota.name} required />
        </FormField>
        <FormField htmlFor="breed" label={t.campos.raza} error={primerError(state, "breed")}>
          <Input id="breed" name="breed" defaultValue={mascota.breed ?? ""} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField htmlFor="species" label={t.campos.especie} error={primerError(state, "species")}>
          <Select id="species" name="species" defaultValue={mascota.species}>
            {PET_SPECIES.map((sp) => (
              <option key={sp} value={sp}>
                {etiquetasEspecie[sp]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="sex" label={t.campos.sexo} error={primerError(state, "sex")}>
          <Select id="sex" name="sex" defaultValue={mascota.sex}>
            {PET_SEXES.map((sx) => (
              <option key={sx} value={sx}>
                {etiquetasSexo[sx]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          htmlFor="sterilized"
          label={t.campos.esterilizada}
          error={primerError(state, "sterilized")}
        >
          <Select
            id="sterilized"
            name="sterilized"
            defaultValue={
              mascota.sterilized === null ? "desconocido" : mascota.sterilized ? "si" : "no"
            }
          >
            <option value="desconocido">{t.esterilizadaOpciones.desconocido}</option>
            <option value="si">{t.esterilizadaOpciones.si}</option>
            <option value="no">{t.esterilizadaOpciones.no}</option>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="birthDate"
          label={t.campos.nacimiento}
          error={primerError(state, "birthDate")}
        >
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={mascota.birth_date ?? ""}
          />
        </FormField>
        <div className="flex items-end gap-2 pb-2">
          <input
            id="approximateBirthDate"
            name="approximateBirthDate"
            type="checkbox"
            defaultChecked={mascota.approximate_birth_date}
            className="h-4 w-4 rounded border-border accent-brand-600"
          />
          <label htmlFor="approximateBirthDate" className="text-sm text-ink">
            {t.campos.aproximada}
          </label>
        </div>
        <FormField htmlFor="color" label={t.campos.color} error={primerError(state, "color")}>
          <Input id="color" name="color" defaultValue={mascota.color ?? ""} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="microchipNumber"
          label={t.campos.microchip}
          error={primerError(state, "microchipNumber")}
        >
          <Input
            id="microchipNumber"
            name="microchipNumber"
            defaultValue={mascota.microchip_number ?? ""}
          />
        </FormField>
        <FormField htmlFor="photo" label={t.campos.foto} error={primerError(state, "photo")}>
          <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        </FormField>
      </div>
      <FormField
        htmlFor="identifyingMarks"
        label={t.campos.senas}
        error={primerError(state, "identifyingMarks")}
      >
        <Input
          id="identifyingMarks"
          name="identifyingMarks"
          defaultValue={mascota.identifying_marks ?? ""}
        />
      </FormField>
      <SubmitButton pendingText={mensajes.comun.guardando}>{mensajes.comun.guardar}</SubmitButton>
    </form>
  );
}
