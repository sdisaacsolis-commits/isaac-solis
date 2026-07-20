"use client";

import { Button } from "@dogtoralia/ui";

import { mensajes } from "@/lib/i18n/es-mx";
import { registrarImpresionReceta } from "@/lib/recetas/actions";

/**
 * Botón de impresión: registra el acceso en la bitácora
 * (log_prescription_access, mejor esfuerzo) y abre el diálogo de impresión.
 */
export function BotonImprimirReceta({ prescriptionId }: { prescriptionId: string }) {
  return (
    <Button
      type="button"
      className="print:hidden"
      onClick={() => {
        void registrarImpresionReceta(prescriptionId);
        window.print();
      }}
    >
      {mensajes.recetas.imprimir.imprimirBoton}
    </Button>
  );
}
