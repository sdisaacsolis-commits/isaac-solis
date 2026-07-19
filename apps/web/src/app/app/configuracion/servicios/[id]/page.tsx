import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { listarVeterinarios, obtenerServicio } from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: mensajes.servicios.editar };

export default async function PaginaEditarServicio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [context, { id }] = await Promise.all([requireTenancyContext(), params]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }
  const [{ servicio, veterinarios: asignaciones }, veterinarios] = await Promise.all([
    obtenerServicio(id),
    listarVeterinarios(context.activeClinic.id),
  ]);
  if (!servicio || servicio.clinic_id !== context.activeClinic.id) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        {mensajes.servicios.editar}: {servicio.name}
      </h1>
      <ServiceForm
        clinicId={context.activeClinic.id}
        veterinarios={veterinarios}
        servicio={servicio}
        asignados={asignaciones.map((a) => a.clinic_member_id)}
      />
    </div>
  );
}
