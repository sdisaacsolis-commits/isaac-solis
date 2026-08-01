import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { mensajes } from "@/lib/i18n/es-mx";
import {
  calcularEdad,
  etiquetasEspecie,
  etiquetasRelacionPropietario,
  nombrePropietario,
} from "@/lib/pets/format";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { OwnerEditForm } from "./owner-edit-form";
import { PortalInviteForm } from "./portal-invite-form";

export const metadata: Metadata = { title: mensajes.pacientes.propietarios.titulo };

const t = mensajes.pacientes.propietarios;

export default async function PaginaFichaPropietario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const context = await requireTenancyContext();
  const supabase = await createClient();

  // RLS decide: si el propietario no está en el alcance del actor, 404.
  const { data: propietario } = await supabase
    .from("pet_owners")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!propietario) notFound();

  const clinicId = context.activeClinic?.id;
  const [
    { data: relacionClinica },
    { data: mascotas },
    { data: consentimientos },
    { data: invitacionPortal },
  ] = await Promise.all([
    clinicId
      ? supabase
          .from("owner_clinic_relationships")
          .select("*")
          .eq("owner_id", id)
          .eq("clinic_id", clinicId)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("pet_owner_relationships")
      .select("*, pets(*)")
      .eq("owner_id", id)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("owner_consents")
      .select("*")
      .eq("owner_id", id)
      .order("granted_at", { ascending: false })
      .limit(10),
    supabase
      .from("portal_invitations")
      .select("id, status, expires_at")
      .eq("owner_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {nombrePropietario(propietario)}
        </h1>
        <Button asChild variant="outline">
          <Link href={`/app/mascotas/nueva?propietario=${propietario.id}`}>
            {t.registrarMascota}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.mascotasDe}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(mascotas ?? []).filter((m) => m.pets).length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sinMascotas}</p>
          ) : (
            (mascotas ?? [])
              .filter((m) => m.pets)
              .map((relacion) => {
                const mascota = relacion.pets!;
                return (
                  <div
                    key={relacion.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
                  >
                    <div>
                      <Link
                        className="font-medium text-brand-700 hover:underline"
                        href={`/app/mascotas/${mascota.id}`}
                      >
                        {mascota.name}
                      </Link>
                      <p className="text-sm text-ink-muted">
                        {etiquetasEspecie[mascota.species]}
                        {mascota.breed ? ` · ${mascota.breed}` : ""}
                        {calcularEdad(mascota.birth_date, mascota.approximate_birth_date)
                          ? ` · ${calcularEdad(mascota.birth_date, mascota.approximate_birth_date)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {relacion.is_primary ? (
                        <Badge variant="brand">{mensajes.pacientes.mascotas.principalBadge}</Badge>
                      ) : (
                        <Badge>{etiquetasRelacionPropietario[relacion.relationship_type]}</Badge>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.datos}</CardTitle>
          {relacionClinica?.internal_customer_number ? (
            <CardDescription>
              {t.campos.numeroCliente}: {relacionClinica.internal_customer_number}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {clinicId ? (
            <OwnerEditForm
              propietario={propietario}
              clinicId={clinicId}
              notas={relacionClinica?.administrative_notes ?? ""}
            />
          ) : (
            <p className="text-sm text-ink-muted">{mensajes.panel.sinClinica}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.portal.titulo}</CardTitle>
          <CardDescription>{t.portal.descripcion}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {propietario.user_id ? (
            <Badge variant="success" className="w-fit">
              {t.portal.vinculado}
            </Badge>
          ) : (
            <>
              {invitacionPortal && new Date(invitacionPortal.expires_at) > new Date() ? (
                <Badge className="w-fit">
                  {t.portal.invitacionPendiente(
                    new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                      timeZone: "America/Mexico_City",
                    }).format(new Date(invitacionPortal.expires_at)),
                  )}
                </Badge>
              ) : (
                <p className="text-sm text-ink-muted">{t.portal.sinVinculo}</p>
              )}
              {clinicId ? (
                <PortalInviteForm
                  clinicId={clinicId}
                  ownerId={propietario.id}
                  tieneCorreo={Boolean(propietario.email)}
                />
              ) : (
                <p className="text-sm text-ink-muted">{mensajes.panel.sinClinica}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.consentimientos}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {(consentimientos ?? []).length === 0 ? (
            <p className="text-ink-muted">{mensajes.comun.sinDatos}</p>
          ) : (
            (consentimientos ?? []).map((consentimiento) => (
              <p key={consentimiento.id} className="text-ink">
                {consentimiento.type} · {consentimiento.document_version} ·{" "}
                {new Intl.DateTimeFormat("es-MX", {
                  dateStyle: "medium",
                  timeZone: "America/Mexico_City",
                }).format(new Date(consentimiento.granted_at))}
                {consentimiento.revoked_at ? " · revocado" : ""}
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
