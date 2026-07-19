import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: mensajes.auth.iniciarSesion.titulo };

const t = mensajes.auth.iniciarSesion;

export default async function PaginaIniciarSesion({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t.titulo}</CardTitle>
        <CardDescription>{t.descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!isSupabaseConfigured() ? (
          <Alert variant="warning">{mensajes.comun.supabaseNoConfigurado}</Alert>
        ) : null}
        {params.error === "enlace-invalido" ? (
          <Alert variant="destructive">{t.enlaceInvalido}</Alert>
        ) : null}
        <LoginForm next={params.next} />
      </CardContent>
    </Card>
  );
}
