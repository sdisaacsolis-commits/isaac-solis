import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dogtoralia/ui";
import { acceptPortalInvitationSchema } from "@dogtoralia/validation";
import type { Metadata } from "next";
import Link from "next/link";

import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { AcceptPortalForm } from "./accept-form";

const t = mensajes.mi.invitacion;

// El enlace contiene un token de un solo uso: jamás debe indexarse.
export const metadata: Metadata = {
  title: t.titulo,
  robots: { index: false, follow: false },
};

export default async function PaginaInvitacionPortal({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenValido = acceptPortalInvitationSchema.safeParse({ token });

  let email: string | null = null;
  if (tokenValido.success && isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  const destino = `/portal/invitacion/${token}`;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">
            <span aria-hidden="true">🐾 </span>
            {t.titulo}
          </CardTitle>
          <CardDescription>{t.descripcion}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!tokenValido.success ? (
            <Alert variant="destructive">{t.formatoInvalido}</Alert>
          ) : email ? (
            <>
              <p className="text-sm text-ink-muted">
                {t.sesionDe} <strong className="text-ink">{email}</strong>.
              </p>
              <AcceptPortalForm token={tokenValido.data.token} />
            </>
          ) : (
            <>
              <Alert variant="info">{t.instruccionSesion}</Alert>
              <div className="flex flex-col gap-2">
                <Button asChild>
                  <Link href={`/iniciar-sesion?next=${encodeURIComponent(destino)}`}>
                    {t.iniciarSesion}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/registro?next=${encodeURIComponent(destino)}`}>
                    {t.crearCuenta}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
