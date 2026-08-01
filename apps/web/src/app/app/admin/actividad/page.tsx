import {
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
import { listarActividadPlataforma } from "@/lib/admin/queries";
import { formatearFechaHora } from "@/lib/agenda/dates";
import { mensajes } from "@/lib/i18n/es-mx";

export const metadata: Metadata = { title: mensajes.admin.nav.actividad };

const t = mensajes.admin.actividad;

// Traducción best-effort de los verbos de auditoría a es-MX; el resto se
// humaniza (separadores → espacios) para que la acción siempre sea legible.
const VERBOS: Record<string, string> = {
  created: "creación",
  updated: "actualización",
  deleted: "eliminación",
  issued: "emisión",
  confirmed: "confirmación",
  cancelled: "cancelación",
  completed: "finalización",
  suspended: "suspensión",
  activated: "activación",
  archived: "archivado",
  invited: "invitación",
  revoked: "revocación",
  restored: "restauración",
};

function humanizar(texto: string): string {
  const limpio = texto.replace(/[._-]+/g, " ").trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function formatearAccion(accion: string): string {
  const partes = accion.split(/[._-]/).filter(Boolean);
  const traducidas = partes.map((parte) => VERBOS[parte] ?? parte);
  return humanizar(traducidas.join(" "));
}

export default async function PaginaAdminActividad() {
  await requireSuperadmin();
  const eventos = await listarActividadPlataforma();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.titulo}</CardTitle>
        <p className="text-sm text-ink-muted">{t.descripcion}</p>
      </CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.vacio}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columnas.accion}</TableHead>
                  <TableHead>{t.columnas.entidad}</TableHead>
                  <TableHead>{t.columnas.fecha}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map((evento) => (
                  <TableRow key={evento.id}>
                    <TableCell className="font-medium">{formatearAccion(evento.action)}</TableCell>
                    <TableCell>{humanizar(evento.entity_type)}</TableCell>
                    <TableCell>{formatearFechaHora(evento.created_at)}</TableCell>
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
