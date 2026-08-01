"use client";

import { HISTORICAL_VACCINATION_SOURCES } from "@dogtoralia/types";
import { FormField, Input, Select, Textarea } from "@dogtoralia/ui";
import { useActionState, useEffect, useState } from "react";

import { FormAlerts, primerError } from "@/components/forms/form-alerts";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/form-state";
import { mensajes } from "@/lib/i18n/es-mx";
import { registrarVacunaAplicada, registrarVacunaHistorica } from "@/lib/vacunacion/actions";

const t = mensajes.vacunacion.nueva;

export interface PacienteParaVacuna {
  petId: string;
  etiqueta: string;
}

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  intervaloDias: number | null;
}

/** Identificador idempotente generado AL MONTAR el formulario (doble clic seguro). */
function useRequestId(): string {
  const [requestId, setRequestId] = useState("");
  useEffect(() => {
    setRequestId(crypto.randomUUID());
  }, []);
  return requestId;
}

function fechaMasDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Aplicación en clínica (solo veterinarios; la RPC lo exige). El intervalo del
 * catálogo SOLO pre-llena la fecha de próxima dosis como sugerencia editable
 * que el veterinario confirma: Dogtoralia jamás decide el esquema.
 */
export function AplicadaVacunaForm({
  clinicId,
  pacientes,
  catalogo,
}: {
  clinicId: string;
  pacientes: PacienteParaVacuna[];
  catalogo: ProductoCatalogo[];
}) {
  const [state, action] = useActionState(registrarVacunaAplicada, initialFormState);
  const requestId = useRequestId();
  const [proximaDosis, setProximaDosis] = useState("");
  const [proximaEditada, setProximaEditada] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinicId} />
      <input type="hidden" name="requestId" value={requestId} />
      <FormAlerts state={state} />
      <FormField
        htmlFor="aplicada-petId"
        label={t.mascota}
        required
        error={primerError(state, "petId")}
      >
        <Select id="aplicada-petId" name="petId" required defaultValue={pacientes[0]?.petId ?? ""}>
          {pacientes.map((paciente) => (
            <option key={paciente.petId} value={paciente.petId}>
              {paciente.etiqueta}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="aplicada-catalogo"
          label={t.producto}
          error={primerError(state, "vaccineCatalogId")}
        >
          <Select
            id="aplicada-catalogo"
            name="vaccineCatalogId"
            defaultValue=""
            onChange={(evento) => {
              // Sugerencia EDITABLE: solo pre-llena si el usuario no capturó nada.
              const producto = catalogo.find((c) => c.id === evento.target.value);
              if (!proximaEditada) {
                setProximaDosis(
                  producto?.intervaloDias ? fechaMasDias(producto.intervaloDias) : "",
                );
              }
            }}
          >
            <option value="">{t.capturaLibre}</option>
            {catalogo.map((producto) => (
              <option key={producto.id} value={producto.id}>
                {producto.nombre}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          htmlFor="aplicada-vaccineName"
          label={t.productoLibre}
          error={primerError(state, "vaccineName")}
        >
          <Input id="aplicada-vaccineName" name="vaccineName" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="aplicada-manufacturer"
          label={t.fabricante}
          error={primerError(state, "manufacturer")}
        >
          <Input id="aplicada-manufacturer" name="manufacturer" />
        </FormField>
        <FormField
          htmlFor="aplicada-diseases"
          label={t.enfermedades}
          error={primerError(state, "diseases")}
        >
          <Input id="aplicada-diseases" name="diseases" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="aplicada-lotNumber"
          label={t.lote}
          error={primerError(state, "lotNumber")}
        >
          <Input id="aplicada-lotNumber" name="lotNumber" />
        </FormField>
        <FormField
          htmlFor="aplicada-expirationDate"
          label={t.caducidad}
          error={primerError(state, "expirationDate")}
        >
          <Input id="aplicada-expirationDate" name="expirationDate" type="date" />
        </FormField>
        <FormField
          htmlFor="aplicada-lotMissingReason"
          label={t.justificacionLote}
          error={primerError(state, "lotMissingReason")}
        >
          <Input id="aplicada-lotMissingReason" name="lotMissingReason" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="aplicada-routeText"
          label={t.via}
          error={primerError(state, "routeText")}
        >
          <Input id="aplicada-routeText" name="routeText" />
        </FormField>
        <FormField
          htmlFor="aplicada-applicationSite"
          label={t.sitio}
          error={primerError(state, "applicationSite")}
        >
          <Input id="aplicada-applicationSite" name="applicationSite" />
        </FormField>
        <FormField
          htmlFor="aplicada-doseText"
          label={t.dosis}
          error={primerError(state, "doseText")}
        >
          <Input id="aplicada-doseText" name="doseText" />
        </FormField>
      </div>
      <FormField
        htmlFor="aplicada-nextDueAt"
        label={t.proximaDosis}
        error={primerError(state, "nextDueAt")}
      >
        <Input
          id="aplicada-nextDueAt"
          name="nextDueAt"
          type="date"
          value={proximaDosis}
          onChange={(evento) => {
            setProximaEditada(true);
            setProximaDosis(evento.target.value);
          }}
        />
      </FormField>
      <p className="text-xs text-ink-muted">{t.pistaProximaDosis}</p>
      <FormField htmlFor="aplicada-notes" label={t.notas} error={primerError(state, "notes")}>
        <Textarea id="aplicada-notes" name="notes" rows={2} />
      </FormField>
      <div>
        <SubmitButton pendingText={t.registrando}>{t.registrarAplicada}</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Registro histórico aportado (propietario, tercero, campaña o importación):
 * la próxima dosis solo la captura un veterinario (la RPC lo exige).
 */
export function HistoricaVacunaForm({
  clinicId,
  pacientes,
  esVeterinario,
}: {
  clinicId: string;
  pacientes: PacienteParaVacuna[];
  esVeterinario: boolean;
}) {
  const [state, action] = useActionState(registrarVacunaHistorica, initialFormState);
  const requestId = useRequestId();
  const t2 = mensajes.vacunacion;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="clinicId" value={clinicId} />
      <input type="hidden" name="requestId" value={requestId} />
      <FormAlerts state={state} />
      <p className="text-sm text-ink-muted">{t.notaHistorica}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="historica-petId"
          label={t.mascota}
          required
          error={primerError(state, "petId")}
        >
          <Select
            id="historica-petId"
            name="petId"
            required
            defaultValue={pacientes[0]?.petId ?? ""}
          >
            {pacientes.map((paciente) => (
              <option key={paciente.petId} value={paciente.petId}>
                {paciente.etiqueta}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          htmlFor="historica-source"
          label={t2.filtroFuente}
          error={primerError(state, "source")}
        >
          <Select id="historica-source" name="source" defaultValue="historical_owner_document">
            {HISTORICAL_VACCINATION_SOURCES.map((fuente) => (
              <option key={fuente} value={fuente}>
                {t2.fuentes[fuente] ?? fuente}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="historica-vaccineName"
          label={t.productoLibre}
          required
          error={primerError(state, "vaccineName")}
        >
          <Input id="historica-vaccineName" name="vaccineName" required />
        </FormField>
        <FormField
          htmlFor="historica-administeredOn"
          label={t.fechaAplicacion}
          required
          error={primerError(state, "administeredOn")}
        >
          <Input id="historica-administeredOn" name="administeredOn" type="date" required />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="historica-manufacturer"
          label={t.fabricante}
          error={primerError(state, "manufacturer")}
        >
          <Input id="historica-manufacturer" name="manufacturer" />
        </FormField>
        <FormField
          htmlFor="historica-diseases"
          label={t.enfermedades}
          error={primerError(state, "diseases")}
        >
          <Input id="historica-diseases" name="diseases" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          htmlFor="historica-lotNumber"
          label={t.lote}
          error={primerError(state, "lotNumber")}
        >
          <Input id="historica-lotNumber" name="lotNumber" />
        </FormField>
        <FormField
          htmlFor="historica-expirationDate"
          label={t.caducidad}
          error={primerError(state, "expirationDate")}
        >
          <Input id="historica-expirationDate" name="expirationDate" type="date" />
        </FormField>
        <FormField
          htmlFor="historica-providerName"
          label={t.proveedorExterno}
          error={primerError(state, "providerName")}
        >
          <Input id="historica-providerName" name="providerName" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor="historica-documentReference"
          label={t.referenciaDocumento}
          error={primerError(state, "documentReference")}
        >
          <Input id="historica-documentReference" name="documentReference" />
        </FormField>
        <FormField htmlFor="historica-file" label={t.comprobante}>
          <Input
            id="historica-file"
            name="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="pt-1.5"
          />
        </FormField>
      </div>
      {esVeterinario ? (
        <FormField
          htmlFor="historica-nextDueAt"
          label={t.proximaDosis}
          error={primerError(state, "nextDueAt")}
        >
          <Input id="historica-nextDueAt" name="nextDueAt" type="date" />
        </FormField>
      ) : (
        <p className="text-xs text-ink-muted">{t.proximaSoloVeterinario}</p>
      )}
      <FormField htmlFor="historica-notes" label={t.notas} error={primerError(state, "notes")}>
        <Textarea id="historica-notes" name="notes" rows={2} />
      </FormField>
      <div>
        <SubmitButton variant="outline" pendingText={t.registrando}>
          {t.registrarHistorica}
        </SubmitButton>
      </div>
    </form>
  );
}
