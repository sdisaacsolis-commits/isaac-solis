import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { mensajes } from "@/lib/i18n/es-mx";

import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: mensajes.auth.recuperar.titulo };

export default function PaginaRecuperarContrasena() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{mensajes.auth.recuperar.titulo}</CardTitle>
        <CardDescription>{mensajes.auth.recuperar.descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        <RecoverForm />
      </CardContent>
    </Card>
  );
}
