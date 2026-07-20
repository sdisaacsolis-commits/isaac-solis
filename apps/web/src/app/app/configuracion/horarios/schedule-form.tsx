"use client";

import { Button, FormField, Input, Select } from "@dogtoralia/ui";
import { useActionState, useState } from "react";

import { FormAlerts } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { configurarHorario } from "@/lib/agenda/actions";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.horarios;
const DIAS = [1, 2, 3, 4, 5, 6, 7] as const;

interface Ventana {
  key: number;
  weekday: number;
  startTime: string;
  endTime: string;
}

interface Props {
  clinicId: string;
  clinicMemberId: string;
  ventanasIniciales: { weekday: number; startTime: string; endTime: string }[];
}

export function ScheduleForm({ clinicId, clinicMemberId, ventanasIniciales }: Props) {
  const [state, action] = useActionState(configurarHorario, initialFormState);
  const [ventanas, setVentanas] = useState<Ventana[]>(
    ventanasIniciales.map((v, i) => ({ key: i, ...v })),
  );

  const agregar = () =>
    setVentanas((prev) => [
      ...prev,
      {
        key: prev.length === 0 ? 0 : Math.max(...prev.map((v) => v.key)) + 1,
        weekday: 1,
        startTime: "09:00",
        endTime: "14:00",
      },
    ]);
  const quitar = (key: number) => setVentanas((prev) => prev.filter((v) => v.key !== key));

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinicId} />
      <input type="hidden" name="clinicMemberId" value={clinicMemberId} />
      <FormAlerts state={state} />

      {ventanas.length === 0 ? <p className="text-sm text-ink-muted">{t.sinVentanas}</p> : null}

      <ul className="flex flex-col gap-3">
        {ventanas.map((ventana, indice) => (
          <li key={ventana.key} className="flex flex-wrap items-end gap-3">
            <FormField htmlFor={`weekday-${ventana.key}`} label={`${t.dia} ${indice + 1}`}>
              <Select
                id={`weekday-${ventana.key}`}
                name="weekday"
                defaultValue={String(ventana.weekday)}
              >
                {DIAS.map((dia) => (
                  <option key={dia} value={dia}>
                    {t.dias[dia]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField htmlFor={`start-${ventana.key}`} label={t.inicio}>
              <Input
                id={`start-${ventana.key}`}
                name="startTime"
                type="time"
                defaultValue={ventana.startTime}
                required
              />
            </FormField>
            <FormField htmlFor={`end-${ventana.key}`} label={t.fin}>
              <Input
                id={`end-${ventana.key}`}
                name="endTime"
                type="time"
                defaultValue={ventana.endTime}
                required
              />
            </FormField>
            <Button type="button" variant="ghost" onClick={() => quitar(ventana.key)}>
              {t.quitar}
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={agregar}>
          {t.agregarVentana}
        </Button>
        <SubmitButton pendingText={t.guardando}>{t.guardarHorario}</SubmitButton>
      </div>
    </form>
  );
}
