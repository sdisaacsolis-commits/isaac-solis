"use client";

import { Button } from "@dogtoralia/ui";

import { mensajes } from "@/lib/i18n/es-mx";
import { registrarImpresionVacunacion } from "@/lib/vacunacion/actions";

/**
 * Botón de impresión: registra el acceso en la bitácora
 * (log_vaccination_access, mejor esfuerzo) y abre el diálogo de impresión.
 * `accessType` distingue comprobante individual ('print') de cartilla
 * ('card_print').
 */
export function BotonImprimirVacunacion({
  recordId,
  accessType = "print",
}: {
  recordId: string | null;
  accessType?: "print" | "card_print";
}) {
  return (
    <Button
      type="button"
      className="print:hidden"
      onClick={() => {
        if (recordId) void registrarImpresionVacunacion(recordId, accessType);
        window.print();
      }}
    >
      {mensajes.vacunacion.imprimir.imprimirBoton}
    </Button>
  );
}
