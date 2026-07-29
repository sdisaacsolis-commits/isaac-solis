import {
  Badge,
  Card,
  CardContent,
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

import { requireSuperadmin } from "@/lib/admin/guard";
import { listarClinicasPlataforma, mapaPlanesPorClinica } from "@/lib/admin/queries";
import { formatearFecha } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEstadoClinica } from "@/lib/roles";

export const metadata: Metadata = { title: mensajes.admin.nav.clinicas };

const t = mensajes.admin.clinicas;

export default async function PaginaAdminClinicas() {
  await requireSuperadmin();
  const clinicas = await listarClinicasPlataforma();
  const planes = await mapaPlanesPorClinica(clinicas.map((clinica) => clinica.clinic_id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.titulo}</CardTitle>
        <p className="text-sm text-ink-muted">{t.descripcion}</p>
      </CardHeader>
      <CardContent>
        {clinicas.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.vacio}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columnas.clinica}</TableHead>
                  <TableHead>{t.columnas.organizacion}</TableHead>
                  <TableHead>{t.columnas.estado}</TableHead>
                  <TableHead>{t.columnas.plan}</TableHead>
                  <TableHead>{t.columnas.publica}</TableHead>
                  <TableHead>{t.columnas.citas}</TableHead>
                  <TableHead>{t.columnas.alta}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinicas.map((clinica) => (
                  <TableRow key={clinica.clinic_id}>
                    <TableCell className="font-medium">{clinica.clinic_name}</TableCell>
                    <TableCell>{clinica.organization_name}</TableCell>
                    <TableCell>
                      <Badge variant={clinica.clinic_status === "active" ? "success" : "warning"}>
                        {etiquetasEstadoClinica[clinica.clinic_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{planes.get(clinica.clinic_id) ?? t.sinPlan}</TableCell>
                    <TableCell>{clinica.is_public ? t.publicaSi : t.publicaNo}</TableCell>
                    <TableCell>{clinica.appointment_count}</TableCell>
                    <TableCell>{formatearFecha(clinica.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
