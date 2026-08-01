"use client";

import { useState } from "react";

import { mensajes } from "@/lib/i18n/es-mx";

const t = mensajes.resenas;

interface Props {
  name: string;
  defaultValue?: number;
  error?: string;
  /** Id base para asociar la etiqueta del grupo. */
  id?: string;
}

/**
 * Selector de estrellas accesible para formularios: grupo de opciones tipo
 * radio (teclado con flechas + Enter/Espacio) que escribe la calificación en un
 * input oculto. La autoridad de validación sigue en Zod y en la RPC.
 */
export function RatingInput({ name, defaultValue = 0, error, id }: Props) {
  const [valor, setValor] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const activo = hover || valor;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-medium text-ink">
        {t.mi.calificacion}
      </span>
      <input type="hidden" name={name} value={valor > 0 ? String(valor) : ""} />
      <div
        role="radiogroup"
        aria-labelledby={id}
        aria-required="true"
        className="inline-flex items-center gap-1"
        onKeyDown={(evento) => {
          if (evento.key === "ArrowRight" || evento.key === "ArrowUp") {
            evento.preventDefault();
            setValor((v) => Math.min(5, (v || 0) + 1));
          } else if (evento.key === "ArrowLeft" || evento.key === "ArrowDown") {
            evento.preventDefault();
            setValor((v) => Math.max(1, (v || 1) - 1));
          }
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={t.nEstrellas(n)}
            tabIndex={valor === n || (valor === 0 && n === 1) ? 0 : -1}
            onClick={() => setValor(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            className={`rounded text-2xl leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              n <= activo ? "text-accent-600" : "text-border"
            }`}
          >
            <span aria-hidden="true">★</span>
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
