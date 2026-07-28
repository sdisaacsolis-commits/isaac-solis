"use client";

import { Button, Input, Textarea } from "@dogtoralia/ui";
import { useActionState, useState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { moderarResena, reportarResena, responderResena } from "@/lib/resenas/actions";

const t = mensajes.resenas.panel;

interface Props {
  reviewId: string;
  status: "published" | "hidden";
  reportada: boolean;
  puedeModerar: boolean;
}

/**
 * Acciones de moderación sobre una reseña: responder (personal operativo),
 * reportar (con motivo) y, solo para administración de la organización,
 * ocultar/restaurar (con motivo). Las RPCs validan permiso y estado; aquí solo
 * se orquesta la UI.
 */
export function AccionesResena({ reviewId, status, reportada, puedeModerar }: Props) {
  const [responderState, responderAction] = useActionState(responderResena, initialFormState);
  const [reportarState, reportarAction] = useActionState(reportarResena, initialFormState);
  const [moderarState, moderarAction] = useActionState(moderarResena, initialFormState);
  const [respondiendo, setRespondiendo] = useState(false);
  const [reportando, setReportando] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <FormAlerts state={responderState} />
      <FormAlerts state={reportarState} />
      <FormAlerts state={moderarState} />

      <div className="flex flex-wrap items-center gap-2">
        {!respondiendo ? (
          <Button size="sm" variant="outline" onClick={() => setRespondiendo(true)}>
            {t.responder}
          </Button>
        ) : null}
        {!reportando ? (
          <Button size="sm" variant="ghost" onClick={() => setReportando(true)}>
            {reportada ? t.yaReportada : t.reportar}
          </Button>
        ) : null}
        {puedeModerar ? (
          <form
            action={moderarAction}
            onSubmit={(evento) => {
              if (status === "published" && !window.confirm(t.confirmarOcultar)) {
                evento.preventDefault();
              }
            }}
            className="inline"
          >
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="hidden" value={status === "published" ? "true" : "false"} />
            <input
              type="hidden"
              name="reason"
              value={status === "published" ? "Moderación de la clínica" : "Restauración"}
            />
            <SubmitButton
              size="sm"
              variant={status === "published" ? "destructive" : "outline"}
              pendingText={t.moderando}
            >
              {status === "published" ? t.ocultar : t.restaurar}
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {respondiendo ? (
        <form action={responderAction} className="flex flex-col gap-2" noValidate>
          <input type="hidden" name="reviewId" value={reviewId} />
          <label htmlFor={`reply-${reviewId}`} className="text-sm font-medium text-ink">
            {t.etiquetaRespuesta}
          </label>
          <Textarea id={`reply-${reviewId}`} name="reply" rows={3} required maxLength={2000} />
          {primerError(responderState, "reply") ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {primerError(responderState, "reply")}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <SubmitButton size="sm" pendingText={t.respondiendo}>
              {t.responder}
            </SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRespondiendo(false)}>
              {mensajes.comun.cancelar}
            </Button>
          </div>
        </form>
      ) : null}

      {reportando ? (
        <form action={reportarAction} className="flex flex-col gap-2" noValidate>
          <input type="hidden" name="reviewId" value={reviewId} />
          <label htmlFor={`report-${reviewId}`} className="text-sm font-medium text-ink">
            {t.motivoReporte}
          </label>
          <Input id={`report-${reviewId}`} name="reason" required maxLength={500} />
          {primerError(reportarState, "reason") ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {primerError(reportarState, "reason")}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <SubmitButton size="sm" variant="outline" pendingText={t.reportando}>
              {t.reportar}
            </SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReportando(false)}>
              {mensajes.comun.cancelar}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
