import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dogtoralia/ui";
import type { Metadata } from "next";

import { mensajes } from "@/lib/i18n/es-mx";
import {
  etiquetasEstadoInvitacion,
  etiquetasEstadoMembresia,
  etiquetasRolClinica,
  etiquetasRolOrganizacion,
  puedeAdministrarClinica,
  puedeAdministrarOrganizacion,
} from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { revocarInvitacion } from "@/lib/tenancy/actions";
import { requireTenancyContext } from "@/lib/tenancy/queries";

import { InviteForm } from "./invite-form";
import { ResendButton } from "./resend-button";

export const metadata: Metadata = { title: mensajes.personal.titulo };

const t = mensajes.personal;

function formatearFecha(valor: string | null): string {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City",
  }).format(new Date(valor));
}

export default async function PaginaPersonal() {
  const context = await requireTenancyContext();
  const supabase = await createClient();
  const organizationId = context.membership.organization.id;

  const rolClinicaActiva = context.activeClinic
    ? (context.clinicMemberships.find((m) => m.clinic_id === context.activeClinic?.id)?.role ??
      null)
    : null;
  const esAdmin =
    puedeAdministrarOrganizacion(context.membership.role) ||
    puedeAdministrarClinica(context.membership.role, rolClinicaActiva);

  const [{ data: miembrosOrg }, { data: miembrosClinica }, { data: invitaciones }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("id, user_id, role, status, joined_at")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .neq("status", "removed")
        .order("joined_at", { ascending: true }),
      context.activeClinic
        ? supabase
            .from("clinic_members")
            .select("id, user_id, role, status, joined_at, professional_license")
            .eq("clinic_id", context.activeClinic.id)
            .is("deleted_at", null)
            .neq("status", "removed")
        : Promise.resolve({ data: [] as never[] }),
      // RLS: solo administradores ven invitaciones; para el resto, 0 filas.
      supabase
        .from("clinic_invitations")
        .select("id, clinic_id, email, role, status, expires_at")
        .eq("status", "pending")
        .order("expires_at", { ascending: true }),
    ]);

  const idsPerfiles = [
    ...new Set([
      ...(miembrosOrg ?? []).map((m) => m.user_id),
      ...(miembrosClinica ?? []).map((m) => m.user_id),
    ]),
  ];
  const { data: perfiles } = idsPerfiles.length
    ? await supabase
        .from("colleague_profiles")
        .select("id, display_name, first_name, last_name")
        .in("id", idsPerfiles)
    : { data: [] };

  const nombreDe = (userId: string): string => {
    const perfil = perfiles?.find((p) => p.id === userId);
    return (
      perfil?.display_name ??
      [perfil?.first_name, perfil?.last_name].filter(Boolean).join(" ") ??
      "—"
    );
  };

  const nombreClinica = (clinicId: string): string =>
    context.clinics.find((c) => c.id === clinicId)?.name ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.miembrosOrganizacion}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.columnas.nombre}</TableHead>
                <TableHead>{t.columnas.rolOrganizacion}</TableHead>
                <TableHead>{t.columnas.estado}</TableHead>
                <TableHead>{t.columnas.incorporacion}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(miembrosOrg ?? []).map((miembro) => (
                <TableRow key={miembro.id}>
                  <TableCell className="font-medium">{nombreDe(miembro.user_id)}</TableCell>
                  <TableCell>{etiquetasRolOrganizacion[miembro.role]}</TableCell>
                  <TableCell>
                    <Badge variant={miembro.status === "active" ? "success" : "warning"}>
                      {etiquetasEstadoMembresia[miembro.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatearFecha(miembro.joined_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {context.activeClinic ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.miembrosClinica}: {context.activeClinic.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(miembrosClinica ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">{mensajes.comun.sinDatos}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.columnas.nombre}</TableHead>
                    <TableHead>{t.columnas.rolClinica}</TableHead>
                    <TableHead>{t.columnas.cedula}</TableHead>
                    <TableHead>{t.columnas.estado}</TableHead>
                    <TableHead>{t.columnas.incorporacion}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(miembrosClinica ?? []).map((miembro) => (
                    <TableRow key={miembro.id}>
                      <TableCell className="font-medium">{nombreDe(miembro.user_id)}</TableCell>
                      <TableCell>{etiquetasRolClinica[miembro.role]}</TableCell>
                      <TableCell>
                        {miembro.role === "veterinarian"
                          ? (miembro.professional_license ?? "—")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={miembro.status === "active" ? "success" : "warning"}>
                          {etiquetasEstadoMembresia[miembro.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatearFecha(miembro.joined_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.invitaciones.titulo}</CardTitle>
          {!esAdmin ? <CardDescription>{t.invitaciones.soloAdmins}</CardDescription> : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {esAdmin ? (
            <>
              {(invitaciones ?? []).length === 0 ? (
                <p className="text-sm text-ink-muted">{t.invitaciones.sinPendientes}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.columnas.correo}</TableHead>
                      <TableHead>{t.invitaciones.clinica}</TableHead>
                      <TableHead>{t.invitaciones.rol}</TableHead>
                      <TableHead>{t.columnas.estado}</TableHead>
                      <TableHead>{t.invitaciones.vence}</TableHead>
                      <TableHead>{t.columnas.acciones}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(invitaciones ?? []).map((invitacion) => (
                      <TableRow key={invitacion.id}>
                        <TableCell className="font-medium">{invitacion.email}</TableCell>
                        <TableCell>{nombreClinica(invitacion.clinic_id)}</TableCell>
                        <TableCell>{etiquetasRolClinica[invitacion.role]}</TableCell>
                        <TableCell>
                          <Badge variant="warning">
                            {etiquetasEstadoInvitacion[invitacion.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatearFecha(invitacion.expires_at)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <ResendButton invitationId={invitacion.id} />
                            <form action={revocarInvitacion}>
                              <input type="hidden" name="invitationId" value={invitacion.id} />
                              <Button type="submit" variant="destructive" size="sm">
                                {t.invitaciones.revocar}
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div>
                <h2 className="mb-3 text-sm font-semibold text-ink">{t.invitaciones.invitar}</h2>
                <InviteForm
                  clinicas={context.clinics.map((c) => ({ id: c.id, name: c.name }))}
                  clinicaActivaId={context.activeClinic?.id}
                />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
