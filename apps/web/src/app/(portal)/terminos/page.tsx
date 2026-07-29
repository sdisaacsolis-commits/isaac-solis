import type { Metadata } from "next";

import { DocumentoLegalView } from "@/components/portal/documento-legal";
import { terminos } from "@/lib/legal";

export const metadata: Metadata = {
  title: terminos.titulo,
  description:
    "Términos y Condiciones del servicio Dogtoralia: objeto, cuenta y roles, uso aceptable, responsabilidad profesional del veterinario y ley aplicable en México.",
};

export default function PaginaTerminos() {
  return <DocumentoLegalView documento={terminos} />;
}
