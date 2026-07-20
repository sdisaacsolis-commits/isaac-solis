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

import { mensajes } from "@/lib/i18n/es-mx";
import { puedeEditarOrganizacion } from "@/lib/roles";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.organizacion.titulo };

import { OrganizationForm } from "./organization-form";

const t = mensajes.organizacion;

export default async function PaginaOrganizacion() {
  const context = await requireTenancyContext();
  const org = context.membership.organization;
  const esOwner = puedeEditarOrganizacion(context.membership.role);

  const fechaCreacion = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: "America/Mexico_City",
  }).format(new Date(org.created_at));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.plan}</CardTitle>
          <CardDescription>{t.gestionComercial}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-ink-muted">{t.plan}</p>
            <p className="font-medium uppercase">{org.plan_code}</p>
          </div>
          <div>
            <p className="text-ink-muted">{t.veterinariosIncluidos}</p>
            <p className="font-medium">{org.included_active_veterinarians}</p>
          </div>
          <div>
            <p className="text-ink-muted">{t.estado}</p>
            <Badge variant={org.status === "active" ? "success" : "warning"}>{org.status}</Badge>
          </div>
          <div>
            <p className="text-ink-muted">{t.creadaEl}</p>
            <p className="font-medium">{fechaCreacion}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.datos}</CardTitle>
          {!esOwner ? <CardDescription>{t.soloOwner}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {esOwner ? (
            <OrganizationForm
              organizationId={org.id}
              defaults={{
                name: org.name,
                slug: org.slug ?? "",
                legalName: org.legal_name ?? "",
                taxId: org.tax_id ?? "",
              }}
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">{t.nombre}</dt>
                <dd className="font-medium">{org.name}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.slug}</dt>
                <dd className="font-medium">{org.slug ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.razonSocial}</dt>
                <dd className="font-medium">{org.legal_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.rfc}</dt>
                <dd className="font-medium">{org.tax_id ?? "—"}</dd>
              </div>
            </dl>
          )}
          {!esOwner ? <Alert className="mt-4">{t.soloOwner}</Alert> : null}
        </CardContent>
      </Card>
    </div>
  );
}
