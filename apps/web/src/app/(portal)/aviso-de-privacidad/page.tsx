import type { Metadata } from "next";

import { DocumentoLegalView } from "@/components/portal/documento-legal";
import { avisoPrivacidad } from "@/lib/legal";

export const metadata: Metadata = {
  title: avisoPrivacidad.titulo,
  description:
    "Aviso de Privacidad Integral de Dogtoralia conforme a la LFPDPPP: datos que tratamos, finalidades, transferencias y derechos ARCO.",
};

export default function PaginaAvisoPrivacidad() {
  return <DocumentoLegalView documento={avisoPrivacidad} />;
}
