"use client";

import { Button } from "@dogtoralia/ui";

import { registrarAccesoImpresion } from "@/lib/clinica/actions";
import { mensajes } from "@/lib/i18n/es-mx";

/**
 * Botón de impresión: registra el acceso en la bitácora (mejor esfuerzo) y
 * abre el diálogo de impresión del navegador. Oculto en el documento impreso.
 */
export function BotonImprimir({ encounterId }: { encounterId: string }) {
  return (
    <Button
      type="button"
      className="print:hidden"
      onClick={() => {
        void registrarAccesoImpresion(encounterId);
        window.print();
      }}
    >
      {mensajes.consultas.imprimir.imprimirBoton}
    </Button>
  );
}
