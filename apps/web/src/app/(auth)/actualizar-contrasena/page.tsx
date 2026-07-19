import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { mensajes } from "@/lib/i18n/es-mx";

import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: mensajes.auth.actualizar.titulo };

export default function PaginaActualizarContrasena() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{mensajes.auth.actualizar.titulo}</CardTitle>
        <CardDescription>{mensajes.auth.actualizar.descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  );
}
