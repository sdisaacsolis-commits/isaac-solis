import type { Metadata } from "next";

import { listarVeterinarios } from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: mensajes.servicios.nuevo };

export default async function PaginaNuevoServicio() {
  const context = await requireTenancyContext();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }
  const veterinarios = await listarVeterinarios(context.activeClinic.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{mensajes.servicios.nuevo}</h1>
      <ServiceForm clinicId={context.activeClinic.id} veterinarios={veterinarios} />
    </div>
  );
}
