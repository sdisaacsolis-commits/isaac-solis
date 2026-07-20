import * as React from "react";

import { cn } from "../lib/cn";
import { Label } from "./label";

export interface FormFieldProps {
  /** id del control asociado (input/select). */
  htmlFor: string;
  label: string;
  /** Primer error de validación del campo (los esquemas Zod ya hablan es-MX). */
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Campo de formulario accesible: label asociado, pista opcional y error
 * anunciado con role="alert". El control hijo debe usar `id === htmlFor` y,
 * cuando haya error, `aria-invalid` + `aria-describedby`.
 */
export function FormField({
  htmlFor,
  label,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
