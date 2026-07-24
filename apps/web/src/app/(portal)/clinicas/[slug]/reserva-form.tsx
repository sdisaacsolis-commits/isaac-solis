"use client";

import { PET_SPECIES } from "@dogtoralia/types";
import { Alert, FormField, Input, Select, Textarea } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie } from "@/lib/pets/format";
import { type ReservaPublicaState, solicitarReservaPublica } from "@/lib/portal/actions";

const t = mensajes.portalPublico.reserva;
const inicial: ReservaPublicaState = { ok: false };

/** Identificador idempotente generado AL MONTAR el formulario (doble envío seguro). */
function useRequestId(): string {
  const [requestId, setRequestId] = useState("");
  useEffect(() => {
    setRequestId(crypto.randomUUID());
  }, []);
  return requestId;
}

interface Props {
  clinicSlug: string;
  serviceId: string;
  veterinarianMemberId: string;
  /** Huecos reales como pares [instante ISO (timestamptz), etiqueta legible]. */
  slots: [string, string][];
}

/**
 * Formulario de invitado del widget público (paridad Doctoralia: reservar sin
 * cuenta). La cita entra como `requested` y la clínica la confirma.
 */
export function ReservaForm({ clinicSlug, serviceId, veterinarianMemberId, slots }: Props) {
  const [state, action] = useActionState(solicitarReservaPublica, inicial);
  const requestId = useRequestId();

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <Alert variant="success">
          <span className="font-semibold">{t.exitoTitulo}</span>{" "}
          {state.folio ? (
            <>
              {t.folio}: <span className="font-mono font-semibold">{state.folio}</span>.{" "}
            </>
          ) : null}
          {t.avisoPendiente}
        </Alert>
        <p>
          <Link className="text-sm font-medium text-brand-700 hover:underline" href="/buscar">
            {t.nuevaBusqueda}
          </Link>
        </p>
      </div>
    );
  }

  if (slots.length === 0) {
    return <p className="text-sm text-ink-muted">{t.sinHorarios}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicSlug" value={clinicSlug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="veterinarianMemberId" value={veterinarianMemberId} />
      <input type="hidden" name="requestId" value={requestId} />
      <FormAlerts state={state} />

      <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-ink">{t.horarios}</legend>
        <div className="grid gap-2 sm:grid-cols-4">
          {slots.map(([valor, etiqueta]) => (
            <div key={valor} className="flex items-center gap-2">
              <input
                id={`hueco-${valor}`}
                type="radio"
                name="start"
                value={valor}
                required
                className="h-4 w-4 border-border accent-brand-600"
              />
              <label htmlFor={`hueco-${valor}`} className="text-sm text-ink">
                {etiqueta}
              </label>
            </div>
          ))}
        </div>
        {primerError(state, "start") ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {primerError(state, "start")}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="reserva-firstName"
          label={t.nombre}
          required
          error={primerError(state, "firstName")}
        >
          <Input id="reserva-firstName" name="firstName" required autoComplete="given-name" />
        </FormField>
        <FormField
          htmlFor="reserva-lastName"
          label={t.apellidos}
          required
          error={primerError(state, "lastName")}
        >
          <Input id="reserva-lastName" name="lastName" required autoComplete="family-name" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="reserva-email"
          label={t.correo}
          required
          error={primerError(state, "email")}
        >
          <Input
            id="reserva-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
          />
        </FormField>
        <FormField htmlFor="reserva-phone" label={t.telefono} error={primerError(state, "phone")}>
          <Input id="reserva-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="reserva-petName"
          label={t.mascota}
          required
          error={primerError(state, "petName")}
        >
          <Input id="reserva-petName" name="petName" required />
        </FormField>
        <FormField
          htmlFor="reserva-petSpecies"
          label={t.especie}
          required
          error={primerError(state, "petSpecies")}
        >
          <Select id="reserva-petSpecies" name="petSpecies" required defaultValue="dog">
            {PET_SPECIES.map((especie) => (
              <option key={especie} value={especie}>
                {etiquetasEspecie[especie]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField htmlFor="reserva-reason" label={t.motivo} error={primerError(state, "reason")}>
        <Textarea id="reserva-reason" name="reason" rows={2} maxLength={1000} />
      </FormField>

      <div>
        <SubmitButton pendingText={t.solicitando}>{t.solicitar}</SubmitButton>
      </div>
    </form>
  );
}
