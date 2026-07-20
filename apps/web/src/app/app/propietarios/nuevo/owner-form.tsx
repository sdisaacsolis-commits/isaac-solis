"use client";

import { CONTACT_METHODS } from "@dogtoralia/types";
import { Alert, Button, Card, CardContent, FormField, Input, Select } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { mensajes } from "@/lib/i18n/es-mx";
import { crearPropietario, type PacienteFormState } from "@/lib/pets/actions";
import { etiquetasMedioContacto } from "@/lib/pets/format";

const t = mensajes.pacientes.propietarios;
const inicial: PacienteFormState = { ok: false };

export function OwnerForm({ clinicId }: { clinicId: string }) {
  const [state, action] = useActionState(crearPropietario, inicial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinicId} />
      <FormAlerts state={state} />

      {state.coincidencias && state.coincidencias.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            {state.coincidencias.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{c.titulo}</p>
                  <p className="text-sm text-ink-muted">{c.detalle}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/app/propietarios/${c.id}`}>
                    {mensajes.pacientes.duplicados.usarExistente}
                  </Link>
                </Button>
              </div>
            ))}
            <Alert variant="warning">{mensajes.pacientes.duplicados.aviso}</Alert>
            <input type="hidden" name="confirmDuplicates" value="true" />
            <SubmitButton pendingText={mensajes.comun.guardando} variant="outline">
              {mensajes.pacientes.duplicados.crearDeTodosModos}
            </SubmitButton>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="firstName"
          label={t.campos.nombre}
          required
          error={primerError(state, "firstName")}
        >
          <Input id="firstName" name="firstName" required />
        </FormField>
        <FormField
          htmlFor="lastName"
          label={t.campos.apellidos}
          required
          error={primerError(state, "lastName")}
        >
          <Input id="lastName" name="lastName" required />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="email" label={t.campos.correo} error={primerError(state, "email")}>
          <Input id="email" name="email" type="email" />
        </FormField>
        <FormField
          htmlFor="preferredContactMethod"
          label={t.campos.medioContacto}
          error={primerError(state, "preferredContactMethod")}
        >
          <Select id="preferredContactMethod" name="preferredContactMethod" defaultValue="phone">
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
          <Input id="phone" name="phone" type="tel" placeholder="+52 55 0000 0000" />
        </FormField>
        <FormField
          htmlFor="secondaryPhone"
          label={t.campos.telefonoSecundario}
          error={primerError(state, "secondaryPhone")}
        >
          <Input id="secondaryPhone" name="secondaryPhone" type="tel" />
        </FormField>
      </div>
      <FormField
        htmlFor="addressLine1"
        label={t.campos.direccion}
        error={primerError(state, "addressLine1")}
      >
        <Input id="addressLine1" name="addressLine1" autoComplete="street-address" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="neighborhood"
          label={t.campos.colonia}
          error={primerError(state, "neighborhood")}
        >
          <Input id="neighborhood" name="neighborhood" />
        </FormField>
        <FormField htmlFor="city" label={t.campos.ciudad} error={primerError(state, "city")}>
          <Input id="city" name="city" />
        </FormField>
        <FormField htmlFor="state" label={t.campos.estado} error={primerError(state, "state")}>
          <Input id="state" name="state" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="postalCode"
          label={t.campos.cp}
          error={primerError(state, "postalCode")}
        >
          <Input id="postalCode" name="postalCode" inputMode="numeric" placeholder="06100" />
        </FormField>
        <FormField
          htmlFor="internalCustomerNumber"
          label={t.campos.numeroCliente}
          error={primerError(state, "internalCustomerNumber")}
        >
          <Input id="internalCustomerNumber" name="internalCustomerNumber" />
        </FormField>
      </div>
      <FormField
        htmlFor="administrativeNotes"
        label={t.campos.notas}
        hint={t.pistaNotas}
        error={primerError(state, "administrativeNotes")}
      >
        <Input id="administrativeNotes" name="administrativeNotes" />
      </FormField>
      <div className="flex items-start gap-2">
        <input
          id="privacyConsent"
          name="privacyConsent"
          type="checkbox"
          defaultChecked
          className="mt-1 h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="privacyConsent" className="text-sm text-ink">
          {t.privacyCheckbox}
        </label>
      </div>
      <SubmitButton pendingText={mensajes.comun.guardando}>{t.nuevo}</SubmitButton>
    </form>
  );
}
