"use client";

import { Alert } from "@dogtoralia/ui";
import Link from "next/link";
import { useActionState } from "react";

import { FormAlerts } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { actualizarVisibilidadClinica } from "@/lib/portal/actions";

const t = mensajes.configuracion.clinicaPublica;

/**
 * Visibilidad pública de la clínica activa (clinic_admin / administración de
 * la organización; RLS decide). El grant de UPDATE ya cubre estas columnas.
 */
export function ClinicaPublicaForm({
  clinicId,
  slug,
  isPublic,
  acceptsOnlineBooking,
}: {
  clinicId: string;
  slug: string | null;
  isPublic: boolean;
  acceptsOnlineBooking: boolean;
}) {
  const [state, action] = useActionState(actualizarVisibilidadClinica, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="clinicId" value={clinicId} />
      <FormAlerts state={state} />
      {!slug ? <Alert variant="warning">{t.requiereSlug}</Alert> : null}
      <div className="flex items-center gap-2">
        <input
          id="clinica-isPublic"
          name="isPublic"
          type="checkbox"
          defaultChecked={isPublic}
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="clinica-isPublic" className="text-sm text-ink">
          {t.esPublica}
        </label>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="clinica-acceptsOnlineBooking"
          name="acceptsOnlineBooking"
          type="checkbox"
          defaultChecked={acceptsOnlineBooking}
          className="h-4 w-4 rounded border-border accent-brand-600"
        />
        <label htmlFor="clinica-acceptsOnlineBooking" className="text-sm text-ink">
          {t.reservacion}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText={mensajes.comun.guardando}>{mensajes.comun.guardar}</SubmitButton>
        {slug && isPublic ? (
          <Link
            className="text-sm font-medium text-brand-700 hover:underline"
            href={`/clinicas/${slug}`}
          >
            {t.verPagina}
          </Link>
        ) : null}
      </div>
    </form>
  );
}
