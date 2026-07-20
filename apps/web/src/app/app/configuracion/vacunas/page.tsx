import {
  Alert,
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

import { mensajes } from "@/lib/i18n/es-mx";
import { etiquetasEspecie } from "@/lib/pets/format";
import { puedeAdministrarClinica } from "@/lib/roles";
import { requireTenancyContext } from "@/lib/tenancy/queries";
import { catalogoVacunas } from "@/lib/vacunacion/queries";

import { VacunaCatalogoForm } from "./vacuna-catalogo-form";

export const metadata: Metadata = { title: mensajes.vacunacion.catalogo.titulo };

const t = mensajes.vacunacion.catalogo;

export default async function PaginaCatalogoVacunas() {
  const context = await requireTenancyContext();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{mensajes.panel.sinClinica}</p>;
  }
  const organizacion = context.membership.organization;

  // Ocultar por rol es solo UX; la política can_manage_vaccine_catalog decide.
  const rolClinica = context.clinicMemberships.find(
    (m) => m.clinic_id === context.activeClinic?.id,
  )?.role;
  const puedeGestionar = puedeAdministrarClinica(context.membership.role, rolClinica);

  const productos = await catalogoVacunas(organizacion.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.titulo}</h1>
        <p className="text-sm text-ink-muted">{t.descripcion}</p>
      </div>

      <Alert>{mensajes.vacunacion.aviso}</Alert>

      {!puedeGestionar ? <Alert variant="warning">{t.soloAdmin}</Alert> : null}

      {productos.length === 0 ? (
        <p className="text-ink-muted">{t.sinProductos}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnaProducto}</TableHead>
              <TableHead>{t.fabricante}</TableHead>
              <TableHead>{t.columnaEspecies}</TableHead>
              <TableHead>{t.columnaIntervalo}</TableHead>
              <TableHead>{t.columnaEstado}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.map((producto) => (
              <TableRow key={producto.id}>
                <TableCell>
                  <p className="font-medium text-ink">{producto.name}</p>
                  {producto.diseases_covered.length > 0 ? (
                    <p className="text-xs text-ink-muted">{producto.diseases_covered.join(", ")}</p>
                  ) : null}
                  {puedeGestionar ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-sm text-brand-700">
                        {t.editar}
                      </summary>
                      <div className="pt-3">
                        <VacunaCatalogoForm organizationId={organizacion.id} producto={producto} />
                      </div>
                    </details>
                  ) : null}
                </TableCell>
                <TableCell>{producto.manufacturer ?? "—"}</TableCell>
                <TableCell>
                  {producto.target_species.length > 0
                    ? producto.target_species.map((e) => etiquetasEspecie[e]).join(", ")
                    : "—"}
                </TableCell>
                <TableCell>
                  {producto.default_booster_interval_days
                    ? t.dias(producto.default_booster_interval_days)
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={producto.active ? "success" : "neutral"}>
                    {producto.active ? t.activo : t.inactivo}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {puedeGestionar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.nuevo}</CardTitle>
          </CardHeader>
          <CardContent>
            <VacunaCatalogoForm organizationId={organizacion.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
