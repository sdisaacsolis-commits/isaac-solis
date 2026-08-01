"use client";

import { Button, FormField, Input, Textarea } from "@dogtoralia/ui";
import { useActionState, useState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { RatingInput } from "@/components/portal/rating-input";
import { RatingStars } from "@/components/portal/rating-stars";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import type { CitaReseñable } from "@/lib/portal/reviews";
import { editarMiResena, enviarResena } from "@/lib/portal/reviews-actions";

const t = mensajes.resenas.mi;

/** Formulario de opinión (alta o edición); comparte campos y usa la acción dada. */
function FormularioOpinion({
  cita,
  modo,
  onCancel,
}: {
  cita: CitaReseñable;
  modo: "crear" | "editar";
  onCancel: () => void;
}) {
  const accion = modo === "crear" ? enviarResena : editarMiResena;
  const [state, action] = useActionState(accion, initialFormState);
  const review = cita.review;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {modo === "crear" ? (
        <input type="hidden" name="appointmentId" value={cita.appointment_id} />
      ) : (
        <input type="hidden" name="reviewId" value={review?.id ?? ""} />
      )}
      <FormAlerts state={state} />
      <RatingInput
        name="rating"
        id={`rating-${cita.appointment_id}`}
        defaultValue={review?.rating ?? 0}
        error={primerError(state, "rating")}
      />
      <FormField
        htmlFor={`titulo-${cita.appointment_id}`}
        label={t.tituloOpcional}
        error={primerError(state, "title")}
      >
        <Input
          id={`titulo-${cita.appointment_id}`}
          name="title"
          maxLength={120}
          defaultValue={review?.title ?? ""}
        />
      </FormField>
      <FormField
        htmlFor={`cuerpo-${cita.appointment_id}`}
        label={t.cuerpo}
        required
        error={primerError(state, "body")}
      >
        <Textarea
          id={`cuerpo-${cita.appointment_id}`}
          name="body"
          rows={4}
          required
          maxLength={2000}
          defaultValue={review?.body ?? ""}
        />
      </FormField>
      <p className="text-xs text-ink-muted">{t.plazoEdicion}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingText={modo === "crear" ? t.enviando : t.guardando}>
          {modo === "crear" ? t.enviar : t.guardar}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.cancelar}
        </Button>
      </div>
    </form>
  );
}

/**
 * Tarjeta de una cita atendida en el portal: muestra la reseña ya publicada con
 * opción de editar, o un botón para dejar la primera opinión. La verificación y
 * los plazos los aplica la RPC; aquí solo se orquesta la UI.
 */
export function OpinionCita({ cita }: { cita: CitaReseñable }) {
  const [editando, setEditando] = useState(false);
  const [creando, setCreando] = useState(false);
  const review = cita.review;

  if (review && !editando) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <RatingStars value={review.rating} size="sm" />
            {review.status === "hidden" ? (
              <span className="text-xs font-medium text-destructive">{t.oculta}</span>
            ) : null}
          </div>
          {review.title ? <p className="font-semibold text-ink">{review.title}</p> : null}
          <p className="whitespace-pre-line text-sm text-ink">{review.body}</p>
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
            {t.editar}
          </Button>
        </div>
      </div>
    );
  }

  if (review && editando) {
    return <FormularioOpinion cita={cita} modo="editar" onCancel={() => setEditando(false)} />;
  }

  if (creando) {
    return <FormularioOpinion cita={cita} modo="crear" onCancel={() => setCreando(false)} />;
  }

  return (
    <div>
      <Button size="sm" onClick={() => setCreando(true)}>
        {t.dejarOpinion}
      </Button>
    </div>
  );
}
