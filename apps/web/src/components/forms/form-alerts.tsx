"use client";

import { Alert } from "@dogtoralia/ui";

import type { FormState } from "@/lib/form-state";

/** Muestra el resultado general de una Server Action (éxito, error o advertencia). */
export function FormAlerts({ state }: { state: FormState }) {
  return (
    <>
      {state.message ? (
        <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>
      ) : null}
      {state.warning ? <Alert variant="warning">{state.warning}</Alert> : null}
    </>
  );
}

/** Primer error de un campo, para pasarlo a FormField. */
export function primerError(state: FormState, campo: string): string | undefined {
  return state.fieldErrors?.[campo]?.[0];
}
