import { Alert, Card, CardContent, CardDescription, CardHeader } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { DESTINO_ONBOARDING, resolveSafeNext } from "@/lib/auth/redirects";
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
  const next = resolveSafeNext(params.next, DESTINO_ONBOARDING);
  const invitacion = /^\/(?:portal\/invitacion|invitaciones)\/[0-9a-f]{64}$/.test(next);

  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.titulo}</h1>
        <CardDescription>{invitacion ? t.descripcionInvitacion : t.descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!isSupabaseConfigured() ? (
          <Alert variant="warning">{mensajes.comun.supabaseNoConfigurado}</Alert>
        ) : null}
        <RegisterForm next={next === DESTINO_ONBOARDING ? undefined : next} />
      </CardContent>
    </Card>
  );
}
