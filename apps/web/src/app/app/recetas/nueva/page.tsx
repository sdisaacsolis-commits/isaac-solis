import { Alert, Card, CardContent } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { mensajes } from "@/lib/i18n/es-mx";
import { consultasFinalizablesParaReceta } from "@/lib/recetas/queries";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { NuevaRecetaForm } from "./nueva-receta-form";

export const metadata: Metadata = { title: mensajes.recetas.seleccion.titulo };

const t = mensajes.recetas.seleccion;

export default async function PaginaNuevaReceta({
  searchParams,
}: {
  searchParams: Promise<{ consulta?: string }>;
}) {
  const [context, params] = await Promise.all([requireTenancyContext(), searchParams]);
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.recetas.sinClinica}</p>;
  }

  const consultas = await consultasFinalizablesParaReceta(context.activeClinic.id);
  const preseleccionada = consultas.find((c) => c.id === params.consulta)?.id;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="text-sm text-ink-muted">{t.descripcion}</p>
      </div>

      <Alert>{mensajes.recetas.aviso}</Alert>

      <Card>
        <CardContent className="pt-6">
          {consultas.length === 0 ? (
            <Alert>{t.sinConsultas}</Alert>
          ) : (
            <NuevaRecetaForm consultas={consultas} preseleccionada={preseleccionada} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
