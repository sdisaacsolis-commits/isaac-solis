import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dogtoralia/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { formatearPrecioMXN } from "@/lib/agenda/dates";
import { listarServicios } from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";

export const metadata: Metadata = { title: mensajes.servicios.titulo };

const t = mensajes.servicios;

export default async function PaginaServicios() {
  const context = await requireTenancyContext();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }
  const servicios = await listarServicios(context.activeClinic.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
          <p className="text-sm text-ink-muted">{t.descripcion}</p>
        </div>
        <Button asChild>
          <Link href="/app/configuracion/servicios/nuevo">{t.nuevo}</Link>
        </Button>
      </div>

      {servicios.length === 0 ? (
        <p className="text-ink-muted">{t.sinServicios}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnaServicio}</TableHead>
              <TableHead>{t.categoria}</TableHead>
              <TableHead>{t.columnaDuracion}</TableHead>
              <TableHead>{t.columnaPrecio}</TableHead>
              <TableHead>{t.columnaEstado}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servicios.map((servicio) => (
              <TableRow key={servicio.id}>
                <TableCell>
                  <Link
                    className="font-medium text-brand-700 hover:underline"
                    href={`/app/configuracion/servicios/${servicio.id}`}
                  >
                    {servicio.name}
                  </Link>
                </TableCell>
                <TableCell>{t.categorias[servicio.category] ?? servicio.category}</TableCell>
                <TableCell>{t.minutos(servicio.duration_minutes)}</TableCell>
                <TableCell>{formatearPrecioMXN(servicio.price_cents)}</TableCell>
                <TableCell>
                  <Badge variant={servicio.active ? "success" : "neutral"}>
                    {servicio.active ? t.activo : t.inactivo}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
