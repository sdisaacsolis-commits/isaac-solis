"use client";

import type { Tables } from "@dogtoralia/types";
import { SERVICE_CATEGORIES } from "@dogtoralia/types";
import { FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { actualizarServicio, crearServicio } from "@/lib/agenda/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.servicios;

interface Props {
  clinicId: string;
  veterinarios: { clinicMemberId: string; nombre: string }[];
  servicio?: Tables<"clinic_services">;
  asignados?: string[];
}

export function ServiceForm({ clinicId, veterinarios, servicio, asignados = [] }: Props) {
  const accion = servicio ? actualizarServicio : crearServicio;
  const [state, action] = useActionState(accion, initialFormState);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4" noValidate>
      {servicio ? (
        <input type="hidden" name="serviceId" value={servicio.id} />
      ) : (
        <input type="hidden" name="clinicId" value={clinicId} />
      )}
      <FormAlerts state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="name" label={t.nombre} required error={primerError(state, "name")}>
          <Input id="name" name="name" defaultValue={servicio?.name ?? ""} required />
        </FormField>
        <FormField
          htmlFor="category"
          label={t.categoria}
          required
          error={primerError(state, "category")}
        >
          <Select
            id="category"
            name="category"
            defaultValue={servicio?.category ?? "consultation"}
            required
          >
            {SERVICE_CATEGORIES.map((categoria) => (
              <option key={categoria} value={categoria}>
                {t.categorias[categoria] ?? categoria}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        htmlFor="description"
        label={t.descripcionCampo}
        error={primerError(state, "description")}
      >
        <Input id="description" name="description" defaultValue={servicio?.description ?? ""} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="durationMinutes"
          label={t.duracion}
          required
          error={primerError(state, "durationMinutes")}
        >
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={5}
            max={480}
            step={5}
            defaultValue={servicio?.duration_minutes ?? 30}
            required
          />
        </FormField>
        <FormField
          htmlFor="price"
          label={t.precio}
          required
          error={primerError(state, "priceCents")}
        >
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={servicio ? servicio.price_cents / 100 : ""}
            required
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="bufferBeforeMinutes"
          label={t.colchonAntes}
          error={primerError(state, "bufferBeforeMinutes")}
        >
          <Input
            id="bufferBeforeMinutes"
            name="bufferBeforeMinutes"
            type="number"
            min={0}
            max={120}
            step={5}
            defaultValue={servicio?.buffer_before_minutes ?? 0}
          />
        </FormField>
        <FormField
          htmlFor="bufferAfterMinutes"
          label={t.colchonDespues}
          error={primerError(state, "bufferAfterMinutes")}
        >
          <Input
            id="bufferAfterMinutes"
            name="bufferAfterMinutes"
            type="number"
            min={0}
            max={120}
            step={5}
            defaultValue={servicio?.buffer_after_minutes ?? 0}
          />
        </FormField>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="requiresVeterinarian"
          name="requiresVeterinarian"
          type="checkbox"
          defaultChecked={servicio?.requires_veterinarian ?? true}
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="requiresVeterinarian" className="text-sm text-ink">
          {t.requiereVeterinario}
        </label>
      </div>

      {servicio ? (
        <div className="flex items-center gap-2">
          <input
            id="active"
            name="active"
            type="checkbox"
            defaultChecked={servicio.active}
            className="h-4 w-4 rounded border-border accent-brand-600"
          />
          <label htmlFor="active" className="text-sm text-ink">
            {t.activo}
          </label>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-ink">{t.veterinarios}</legend>
        {veterinarios.length === 0 ? (
          <p className="text-sm text-ink-muted">{mensajes.horarios.sinVeterinarios}</p>
        ) : (
          veterinarios.map((veterinario) => (
            <div key={veterinario.clinicMemberId} className="flex items-center gap-2">
              <input
                id={`vet-${veterinario.clinicMemberId}`}
                name="veterinarianMemberIds"
                value={veterinario.clinicMemberId}
                type="checkbox"
                defaultChecked={asignados.includes(veterinario.clinicMemberId)}
                className="h-4 w-4 rounded border-border accent-brand-600"
              />
              <label htmlFor={`vet-${veterinario.clinicMemberId}`} className="text-sm text-ink">
                {veterinario.nombre}
              </label>
            </div>
          ))
        )}
      </fieldset>

      <SubmitButton pendingText={t.guardando}>{t.guardar}</SubmitButton>
    </form>
  );
}
