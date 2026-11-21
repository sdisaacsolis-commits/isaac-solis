import { Alert, Card, CardContent, CardDescription, CardHeader } from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { DESTINO_ONBOARDING, resolveSafeNext } from "@/lib/auth/redirects";
import { CLINIC_PLAN_PATH, CLINIC_TRIAL, CLINIC_TRIAL_QUERY } from "@/lib/clinic-plans/catalog";
import { mensajes } from "@/lib/i18n/es-mx";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: mensajes.auth.registro.titulo };

const t = mensajes.auth.registro;

export default async function PaginaRegistro({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const next = resolveSafeNext(params.next, DESTINO_ONBOARDING);
  const invitacion = /^\/(?:portal\/invitacion|invitaciones)\/[0-9a-f]{64}$/.test(next);

  const prueba = !invitacion && next === DESTINO_ONBOARDING && params.plan === CLINIC_TRIAL_QUERY;
  const descripcion = invitacion
    ? t.descripcionInvitacion
    : prueba
      ? t.descripcionPrueba(CLINIC_TRIAL.days)
      : t.descripcion;

  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.titulo}</h1>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!isSupabaseConfigured() ? (
          <Alert variant="warning">{mensajes.comun.supabaseNoConfigurado}</Alert>
        ) : null}
        <RegisterForm next={next === DESTINO_ONBOARDING ? undefined : next} />
        {prueba ? (
          <Link
            href={CLINIC_PLAN_PATH}
            className="text-center text-sm font-medium text-brand-700 underline"
          >
            {t.volverPlanes}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
