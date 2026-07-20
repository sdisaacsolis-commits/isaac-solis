import { Alert, Card, CardContent, CardHeader, CardTitle } from "@dogtoralia/ui";
import type { Metadata } from "next";

import { listarPacientesParaAgenda } from "@/lib/agenda/queries";
import { mensajes } from "@/lib/i18n/es-mx";
import { requireTenancyContext } from "@/lib/tenancy/queries";
import { catalogoVacunas } from "@/lib/vacunacion/queries";

import { AplicadaVacunaForm, HistoricaVacunaForm } from "./vacunacion-forms";

export const metadata: Metadata = { title: mensajes.vacunacion.nueva.titulo };

const t = mensajes.vacunacion;

export default async function PaginaNuevaVacuna() {
  const context = await requireTenancyContext();
  if (!context.activeClinic) {
    return <p className="text-ink-muted">{t.sinClinica}</p>;
  }
  const clinica = context.activeClinic;

  // Ocultar por rol es solo UX: la RPC record_vaccination exige veterinario
  // activo y record_historical_vaccination exige rol autorizado (la BD manda).
  const rol = context.clinicMemberships.find((m) => m.clinic_id === clinica.id)?.role;
  const esVeterinario = rol === "veterinarian";

  const [pacientes, catalogo] = await Promise.all([
    listarPacientesParaAgenda(clinica.id),
    catalogoVacunas(context.membership.organization.id, { soloActivos: true }),
  ]);

  const pacientesParaForm = pacientes.map((p) => ({ petId: p.petId, etiqueta: p.etiqueta }));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{t.nueva.titulo}</h1>
        <p className="text-sm text-ink-muted">{t.nueva.descripcion}</p>
      </div>

      <Alert>{t.aviso}</Alert>

      {pacientes.length === 0 ? (
        <Alert>{t.nueva.sinMascotas}</Alert>
      ) : (
        <>
          <section aria-label={t.nueva.seccionAplicada}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.nueva.seccionAplicada}</CardTitle>
              </CardHeader>
              <CardContent>
                {esVeterinario ? (
                  <AplicadaVacunaForm
                    clinicId={clinica.id}
                    pacientes={pacientesParaForm}
                    catalogo={catalogo.map((producto) => ({
                      id: producto.id,
                      nombre: producto.manufacturer
                        ? `${producto.name} — ${producto.manufacturer}`
                        : producto.name,
                      intervaloDias: producto.default_booster_interval_days,
                    }))}
                  />
                ) : (
                  <Alert>{t.nueva.soloVeterinarioAplica}</Alert>
                )}
              </CardContent>
            </Card>
          </section>

          <section aria-label={t.nueva.seccionHistorica}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.nueva.seccionHistorica}</CardTitle>
              </CardHeader>
              <CardContent>
                <HistoricaVacunaForm
                  clinicId={clinica.id}
                  pacientes={pacientesParaForm}
                  esVeterinario={esVeterinario}
                />
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
