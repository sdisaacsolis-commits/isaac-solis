import {
  Alert,
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
import { resolverAlerta, transferirPropietarioPrincipal } from "@/lib/pets/actions";
import {
  calcularEdad,
  etiquetasEspecie,
  etiquetasEstadoRelacionClinica,
  etiquetasRelacionPropietario,
  etiquetasSeveridadAlerta,
  etiquetasSexo,
  etiquetasTipoAlerta,
  nombrePropietario,
} from "@/lib/pets/format";
import { firmarFotoMascota } from "@/lib/pets/photos";
import { createClient } from "@/lib/supabase/server";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { AddOwnerForm, AlertForm } from "./pet-detail-forms";

export const metadata: Metadata = { title: mensajes.pacientes.mascotas.ficha };

const t = mensajes.pacientes.mascotas;

function fecha(valor: string | null): string {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City",
  }).format(new Date(valor));
}

export default async function PaginaFichaMascota({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ foto?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.string().uuid().safeParse(id).success) notFound();

  const context = await requireTenancyContext();
  const supabase = await createClient();

  const { data: mascota } = await supabase.from("pets").select("*").eq("id", id).maybeSingle();
  if (!mascota) notFound();

  const clinicId = context.activeClinic?.id;
  const [
    { data: relacionesPropietarios },
    { data: relacionClinica },
    { data: alertas },
    fotoUrl,
    { data: relacionesClinicaOwner },
  ] = await Promise.all([
    supabase
      .from("pet_owner_relationships")
      .select("*, pet_owners(*)")
      .eq("pet_id", id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("is_primary", { ascending: false }),
    clinicId
      ? supabase
          .from("clinic_pet_relationships")
          .select("*")
          .eq("pet_id", id)
          .eq("clinic_id", clinicId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    clinicId
      ? supabase
          .from("pet_alerts")
          .select("*")
          .eq("pet_id", id)
          .eq("clinic_id", clinicId)
          .eq("active", true)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    firmarFotoMascota(mascota.photo_path),
    clinicId
      ? supabase
          .from("owner_clinic_relationships")
          .select("owner_id, pet_owners!inner(id, first_name, last_name, display_name)")
          .eq("clinic_id", clinicId)
          .eq("status", "active")
          .is("deleted_at", null)
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const propietariosClinica = (relacionesClinicaOwner ?? []).map((r) => ({
    id: r.owner_id,
    nombre: nombrePropietario(
      r.pet_owners as { display_name: string | null; first_name: string; last_name: string },
    ),
  }));
  const edad = calcularEdad(mascota.birth_date, mascota.approximate_birth_date);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {query.foto === "error" ? <Alert variant="warning">{t.fotoError}</Alert> : null}

      <div className="flex flex-wrap items-start gap-6">
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal; next/image no aplica
          <img
            src={fotoUrl}
            alt={`Fotografía de ${mascota.name}`}
            className="h-32 w-32 rounded-card border border-border object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-32 w-32 items-center justify-center rounded-card border border-border bg-surface-muted text-4xl"
          >
            {mascota.species === "cat" ? "🐱" : mascota.species === "dog" ? "🐶" : "🐾"}
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{mascota.name}</h1>
            {relacionClinica ? (
              <Badge variant={relacionClinica.status === "active" ? "success" : "warning"}>
                {etiquetasEstadoRelacionClinica[relacionClinica.status]}
              </Badge>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/mascotas/${mascota.id}/editar`}>{t.editar}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/mascotas/${mascota.id}/expediente`}>
                {mensajes.consultas.expediente.verExpediente}
              </Link>
            </Button>
          </div>
          <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-muted">{t.columnas.especie}</dt>
              <dd className="font-medium">
                {etiquetasEspecie[mascota.species]}
                {mascota.breed ? ` · ${mascota.breed}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t.columnas.sexo}</dt>
              <dd className="font-medium">{etiquetasSexo[mascota.sex]}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t.columnas.edad}</dt>
              <dd className="font-medium">{edad ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t.nacimiento}</dt>
              <dd className="font-medium">
                {mascota.birth_date ?? "—"}
                {mascota.approximate_birth_date ? ` (${t.fechaAproximada.toLowerCase()})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t.microchip}</dt>
              <dd className="font-medium">{mascota.microchip_number ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">{t.esterilizada}</dt>
              <dd className="font-medium">
                {mascota.sterilized === null
                  ? t.esterilizadaOpciones.desconocido
                  : mascota.sterilized
                    ? t.esterilizadaOpciones.si
                    : t.esterilizadaOpciones.no}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.seccionPropietarios}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(relacionesPropietarios ?? [])
            .filter((r) => r.pet_owners)
            .map((relacion) => {
              const propietario = relacion.pet_owners!;
              return (
                <div
                  key={relacion.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
                >
                  <div>
                    <Link
                      className="font-medium text-brand-700 hover:underline"
                      href={`/app/propietarios/${propietario.id}`}
                    >
                      {nombrePropietario(propietario)}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      {etiquetasRelacionPropietario[relacion.relationship_type]}
                      {relacion.can_make_medical_decisions ? ` · ${t.decideMedico}` : ""}
                      {relacion.can_receive_notifications ? ` · ${t.recibeNotificaciones}` : ""}
                    </p>
                  </div>
                  {relacion.is_primary ? (
                    <Badge variant="brand">{t.principalBadge}</Badge>
                  ) : (
                    <form action={transferirPropietarioPrincipal}>
                      <input type="hidden" name="petId" value={mascota.id} />
                      <input type="hidden" name="ownerId" value={propietario.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        {t.hacerPrincipal}
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
          <AddOwnerForm petId={mascota.id} propietarios={propietariosClinica} />
        </CardContent>
      </Card>

      {relacionClinica ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.seccionClinica}</CardTitle>
            <CardDescription>{context.activeClinic?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-muted">{t.numeroInterno}</dt>
                <dd className="font-medium">{relacionClinica.internal_patient_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.alta}</dt>
                <dd className="font-medium">{fecha(relacionClinica.first_visit_at)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">{t.ultimaVisita}</dt>
                <dd className="font-medium">{fecha(relacionClinica.last_visit_at)}</dd>
              </div>
            </dl>
            {relacionClinica.administrative_notes ? (
              <p className="mt-3 text-sm text-ink">
                <span className="text-ink-muted">{t.notasClinica}: </span>
                {relacionClinica.administrative_notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.seccionAlertas}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(alertas ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">{t.sinAlertas}</p>
          ) : (
            (alertas ?? []).map((alerta) => (
              <div
                key={alerta.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2"
              >
                <div>
                  <p className="font-medium text-ink">
                    {alerta.title}{" "}
                    <Badge variant={alerta.severity === "critical" ? "destructive" : "warning"}>
                      {etiquetasSeveridadAlerta[alerta.severity]}
                    </Badge>
                  </p>
                  <p className="text-sm text-ink-muted">
                    {etiquetasTipoAlerta[alerta.type]}
                    {alerta.description ? ` · ${alerta.description}` : ""}
                  </p>
                </div>
                <form action={resolverAlerta}>
                  <input type="hidden" name="alertId" value={alerta.id} />
                  <input type="hidden" name="petId" value={mascota.id} />
                  <Button type="submit" variant="outline" size="sm">
                    {t.resolver}
                  </Button>
                </form>
              </div>
            ))
          )}
          {clinicId ? <AlertForm petId={mascota.id} clinicId={clinicId} /> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          t.proximamente.citas,
          t.proximamente.vacunas,
          t.proximamente.recetas,
          t.proximamente.documentos,
        ].map((titulo) => (
          <Card key={titulo}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                {titulo}
                <Badge variant="brand">{mensajes.comun.proximamente}</Badge>
              </CardTitle>
              <CardDescription>{t.proximamente.texto}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
