"use client";

import { CONTACT_METHODS, type Tables } from "@dogtoralia/types";
import { FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { mensajes } from "@/lib/i18n/es-mx";
import { actualizarPropietario, type PacienteFormState } from "@/lib/pets/actions";
import { etiquetasMedioContacto } from "@/lib/pets/format";

const t = mensajes.pacientes.propietarios;
const inicial: PacienteFormState = { ok: false };

interface Props {
  propietario: Tables<"pet_owners">;
  clinicId: string;
  notas: string;
}

export function OwnerEditForm({ propietario, clinicId, notas }: Props) {
  const [state, action] = useActionState(actualizarPropietario, inicial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="ownerId" value={propietario.id} />
      <input type="hidden" name="clinicId" value={clinicId} />
      <FormAlerts state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="firstName"
          label={t.campos.nombre}
          required
          error={primerError(state, "firstName")}
        >
          <Input id="firstName" name="firstName" defaultValue={propietario.first_name} required />
        </FormField>
        <FormField
          htmlFor="lastName"
          label={t.campos.apellidos}
          required
          error={primerError(state, "lastName")}
        >
          <Input id="lastName" name="lastName" defaultValue={propietario.last_name} required />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="email" label={t.campos.correo} error={primerError(state, "email")}>
          <Input id="email" name="email" type="email" defaultValue={propietario.email ?? ""} />
        </FormField>
        <FormField
          htmlFor="preferredContactMethod"
          label={t.campos.medioContacto}
          error={primerError(state, "preferredContactMethod")}
        >
          <Select
            id="preferredContactMethod"
            name="preferredContactMethod"
            defaultValue={propietario.preferred_contact_method}
          >
            {CONTACT_METHODS.map((metodo) => (
              <option key={metodo} value={metodo}>
                {etiquetasMedioContacto[metodo]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="phone" label={t.campos.telefono} error={primerError(state, "phone")}>
          <Input id="phone" name="phone" type="tel" defaultValue={propietario.phone ?? ""} />
        </FormField>
        <FormField
          htmlFor="secondaryPhone"
          label={t.campos.telefonoSecundario}
          error={primerError(state, "secondaryPhone")}
        >
          <Input
            id="secondaryPhone"
            name="secondaryPhone"
            type="tel"
            defaultValue={propietario.secondary_phone ?? ""}
          />
        </FormField>
      </div>
      <FormField
        htmlFor="addressLine1"
        label={t.campos.direccion}
        error={primerError(state, "addressLine1")}
      >
        <Input
          id="addressLine1"
          name="addressLine1"
          defaultValue={propietario.address_line_1 ?? ""}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="neighborhood"
          label={t.campos.colonia}
          error={primerError(state, "neighborhood")}
        >
          <Input
            id="neighborhood"
            name="neighborhood"
            defaultValue={propietario.neighborhood ?? ""}
          />
        </FormField>
        <FormField htmlFor="city" label={t.campos.ciudad} error={primerError(state, "city")}>
          <Input id="city" name="city" defaultValue={propietario.city ?? ""} />
        </FormField>
        <FormField htmlFor="state" label={t.campos.estado} error={primerError(state, "state")}>
          <Input id="state" name="state" defaultValue={propietario.state ?? ""} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="postalCode"
          label={t.campos.cp}
          error={primerError(state, "postalCode")}
        >
          <Input id="postalCode" name="postalCode" defaultValue={propietario.postal_code ?? ""} />
        </FormField>
      </div>
      <FormField
        htmlFor="administrativeNotes"
        label={t.campos.notas}
        hint={t.pistaNotas}
        error={primerError(state, "administrativeNotes")}
      >
        <Input id="administrativeNotes" name="administrativeNotes" defaultValue={notas} />
      </FormField>
      <SubmitButton pendingText={mensajes.comun.guardando}>{mensajes.comun.guardar}</SubmitButton>
    </form>
  );
}
