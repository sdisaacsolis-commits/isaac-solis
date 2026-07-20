import { Alert, Card, CardContent } from "@dogtoralia/ui";
import type { Metadata } from "next";

import {
  listarPacientesParaAgenda,
  listarServicios,
  listarVeterinarios,
} from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { WalkInForm } from "./walk-in-form";

export const metadata: Metadata = { title: mensajes.consultas.nueva.titulo };

const t = mensajes.consultas.nueva;

export default async function PaginaNuevaConsulta() {
  const context = await requireTenancyContext();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.consultas.sinClinica}</p>;
  }
  const clinica = context.activeClinic;

  const [pacientes, servicios, veterinarios] = await Promise.all([
    listarPacientesParaAgenda(clinica.id),
    listarServicios(clinica.id, { soloActivos: true }),
    listarVeterinarios(clinica.id),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="text-sm text-ink-muted">{t.descripcion}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {pacientes.length === 0 ? (
            <Alert>{t.sinPacientes}</Alert>
          ) : (
            <WalkInForm
              clinicId={clinica.id}
              pacientes={pacientes}
              servicios={servicios.map((s) => ({
                id: s.id,
                nombre: `${s.name} (${mensajes.servicios.minutos(s.duration_minutes)})`,
              }))}
              veterinarios={veterinarios}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
