import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { OwnerForm } from "./owner-form";

export const metadata: Metadata = { title: mensajes.pacientes.propietarios.nuevo };

export default async function PaginaNuevoPropietario() {
  const context = await requireTenancyContext();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{mensajes.pacientes.propietarios.nuevo}</CardTitle>
          <CardDescription>{context.activeClinic.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <OwnerForm clinicId={context.activeClinic.id} />
        </CardContent>
      </Card>
    </div>
  );
}
