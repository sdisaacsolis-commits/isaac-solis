import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEstadoClinica, puedeAdministrarClinica } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { ClinicEditForm } from "./clinic-edit-form";

export const metadata: Metadata = { title: mensajes.clinicas.detalle };

const t = mensajes.clinicas;

export default async function PaginaDetalleClinica({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const context = await requireTenancyContext();
  const supabase = await createClient();

  // RLS decide el acceso: si no es visible para este usuario, 404.
  const { data: clinica } = await supabase.from("clinics").select("*").eq("id", id).maybeSingle();
  if (!clinica) notFound();

  const rolEnClinica =
    context.clinicMemberships.find((m) => m.clinic_id === clinica.id)?.role ?? null;
  const puedeEditar = puedeAdministrarClinica(context.membership.role, rolEnClinica);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{clinica.name}</h1>
        <Badge variant={clinica.status === "active" ? "success" : "warning"}>
          {etiquetasEstadoClinica[clinica.status]}
        </Badge>
      </div>
      <Alert>{t.cicloVida}</Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{puedeEditar ? t.editar : t.detalle}</CardTitle>
          {!puedeEditar ? <CardDescription>{mensajes.personal.sinAcceso}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {puedeEditar ? (
            <ClinicEditForm clinica={clinica} />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">{t.campos.correo}</dt>
                <dd className="font-medium">{clinica.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.campos.telefono}</dt>
                <dd className="font-medium">{clinica.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.campos.ciudad}</dt>
                <dd className="font-medium">{clinica.city ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.campos.zonaHoraria}</dt>
                <dd className="font-medium">{clinica.timezone}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
