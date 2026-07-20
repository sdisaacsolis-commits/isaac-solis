"use client";

import { OWNER_PET_RELATIONSHIP_TYPES, PET_SEXES, PET_SPECIES } from "@dogtoralia/types";
import { Alert, Button, Card, CardContent, FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { mensajes } from "@/lib/i18n/es-mx";
import { crearMascota, type PacienteFormState, vincularMascotaExistente } from "@/lib/pets/actions";
import { etiquetasEspecie, etiquetasRelacionPropietario, etiquetasSexo } from "@/lib/pets/format";

const t = mensajes.pacientes.mascotas;
const inicial: PacienteFormState = { ok: false };

interface Props {
  clinicId: string;
  propietarios: { id: string; nombre: string }[];
  propietarioPreseleccionado?: string;
}

export function PetForm({ clinicId, propietarios, propietarioPreseleccionado }: Props) {
  const [state, action] = useActionState(crearMascota, inicial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinicId} />
      <FormAlerts state={state} />

      {state.coincidencias && state.coincidencias.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <Alert variant="warning">{mensajes.pacientes.duplicados.aviso}</Alert>
            {state.coincidencias.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{c.titulo}</p>
                  <p className="text-sm text-ink-muted">{c.detalle}</p>
                </div>
                <Button
                  formAction={vincularMascotaExistente}
                  name="petId"
                  value={c.id}
                  variant="outline"
                  size="sm"
                >
                  {mensajes.pacientes.duplicados.usarExistente}
                </Button>
              </div>
            ))}
            <input type="hidden" name="confirmDuplicates" value="true" />
            <SubmitButton pendingText={mensajes.comun.guardando} variant="outline">
              {mensajes.pacientes.duplicados.crearDeTodosModos}
            </SubmitButton>
          </CardContent>
        </Card>
      ) : null}

      <FormField
        htmlFor="ownerId"
        label={t.campos.propietario}
        required
        error={primerError(state, "ownerId")}
      >
        <Select
          id="ownerId"
          name="ownerId"
          defaultValue={propietarioPreseleccionado ?? ""}
          required
        >
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="name"
          label={t.campos.nombre}
          required
          error={primerError(state, "name")}
        >
          <Input id="name" name="name" required />
        </FormField>
        <FormField
          htmlFor="relationshipType"
          label={t.campos.relacion}
          error={primerError(state, "relationshipType")}
        >
          <Select id="relationshipType" name="relationshipType" defaultValue="owner">
            {OWNER_PET_RELATIONSHIP_TYPES.map((tipo) => (
              <option key={tipo} value={tipo}>
                {etiquetasRelacionPropietario[tipo]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="species"
          label={t.campos.especie}
          required
          error={primerError(state, "species")}
        >
          <Select id="species" name="species" defaultValue="dog" required>
            {PET_SPECIES.map((sp) => (
              <option key={sp} value={sp}>
                {etiquetasEspecie[sp]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField htmlFor="breed" label={t.campos.raza} error={primerError(state, "breed")}>
          <Input id="breed" name="breed" />
        </FormField>
        <FormField htmlFor="sex" label={t.campos.sexo} error={primerError(state, "sex")}>
          <Select id="sex" name="sex" defaultValue="unknown">
            {PET_SEXES.map((sx) => (
              <option key={sx} value={sx}>
                {etiquetasSexo[sx]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="birthDate"
          label={t.campos.nacimiento}
          error={primerError(state, "birthDate")}
        >
          <Input id="birthDate" name="birthDate" type="date" />
        </FormField>
        <div className="flex items-end gap-2 pb-2">
          <input
            id="approximateBirthDate"
            name="approximateBirthDate"
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-brand-600"
          />
          <label htmlFor="approximateBirthDate" className="text-sm text-ink">
            {t.campos.aproximada}
          </label>
        </div>
        <FormField
          htmlFor="sterilized"
          label={t.campos.esterilizada}
          error={primerError(state, "sterilized")}
        >
          <Select id="sterilized" name="sterilized" defaultValue="desconocido">
            <option value="desconocido">{t.esterilizadaOpciones.desconocido}</option>
            <option value="si">{t.esterilizadaOpciones.si}</option>
            <option value="no">{t.esterilizadaOpciones.no}</option>
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="color" label={t.campos.color} error={primerError(state, "color")}>
          <Input id="color" name="color" />
        </FormField>
        <FormField
          htmlFor="microchipNumber"
          label={t.campos.microchip}
          error={primerError(state, "microchipNumber")}
        >
          <Input id="microchipNumber" name="microchipNumber" />
        </FormField>
      </div>
      <FormField
        htmlFor="identifyingMarks"
        label={t.campos.senas}
        error={primerError(state, "identifyingMarks")}
      >
        <Input id="identifyingMarks" name="identifyingMarks" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="internalPatientNumber"
          label={t.campos.numeroInterno}
          error={primerError(state, "internalPatientNumber")}
        >
          <Input id="internalPatientNumber" name="internalPatientNumber" />
        </FormField>
        <FormField htmlFor="photo" label={t.campos.foto} error={primerError(state, "photo")}>
          <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
        </FormField>
      </div>
      <SubmitButton pendingText={mensajes.comun.guardando}>{t.nueva}</SubmitButton>
    </form>
  );
}
