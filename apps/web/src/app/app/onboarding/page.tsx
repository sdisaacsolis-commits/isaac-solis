import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { mensajes } from "@/lib/i18n/es-mx";
import { getTenancyContext } from "@/lib/tenancy/queries";

import { ClinicStep } from "./clinic-step";
import { OrganizationStep } from "./organization-step";
import { ProfileStep } from "./profile-step";

export const metadata: Metadata = { title: mensajes.onboarding.titulo };

const t = mensajes.onboarding;

export default async function PaginaOnboarding() {
  const context = await getTenancyContext();

  const perfilCompleto = Boolean(
    context.profile?.first_name && context.profile?.last_name && context.profile?.display_name,
  );

  let paso: 1 | 2 | 3;
  if (!perfilCompleto) {
    paso = 1;
  } else if (!context.membership) {
    paso = 2;
  } else if (context.clinics.length === 0) {
    paso = 3;
  } else {
    redirect("/app/inicio");
  }

  const seccion = paso === 1 ? t.perfil : paso === 2 ? t.organizacion : t.clinica;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-2 text-sm font-medium uppercase tracking-wide text-brand-700">
        {t.pasoDe(paso, 3)}
      </p>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{seccion.titulo}</CardTitle>
          <CardDescription>{seccion.descripcion}</CardDescription>
        </CardHeader>
        <CardContent>
          {paso === 1 ? (
            <ProfileStep
              defaults={{
                firstName: context.profile?.first_name ?? "",
                lastName: context.profile?.last_name ?? "",
                displayName: context.profile?.display_name ?? "",
                phone: context.profile?.phone ?? "",
                timezone: context.profile?.timezone ?? "America/Mexico_City",
              }}
            />
          ) : paso === 2 ? (
            <OrganizationStep />
          ) : (
            <ClinicStep organizationId={context.membership!.organization.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
