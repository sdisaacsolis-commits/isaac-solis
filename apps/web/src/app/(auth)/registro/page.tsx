import { Alert, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: mensajes.auth.registro.titulo };

const t = mensajes.auth.registro;

export default async function PaginaRegistro({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
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
        <RegisterForm next={params.next} />
      </CardContent>
    </Card>
  );
}
