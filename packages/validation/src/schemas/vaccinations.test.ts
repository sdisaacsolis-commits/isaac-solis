import { describe, expect, it } from "vitest";

import {
  recordHistoricalVaccinationSchema,
  recordVaccinationSchema,
  vaccineCatalogSchema,
  voidVaccinationSchema,
} from "./vaccinations";

const uuid = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const uuid2 = "7f9619ff-8b86-4d01-b42d-00cf4fc964aa";

const aplicacionValida = {
  clinicId: uuid,
  petId: uuid2,
  vaccineCatalogId: uuid,
  lotNumber: "L-2026-77",
  expirationDate: "2027-08-01",
  requestId: uuid2,
};

describe("recordVaccinationSchema (aplicación en clínica)", () => {
  it("acepta una aplicación con catálogo, lote y caducidad", () => {
    expect(recordVaccinationSchema.safeParse(aplicacionValida).success).toBe(true);
  });

  it("exige producto: catálogo o nombre capturado", () => {
    expect(
      recordVaccinationSchema.safeParse({ ...aplicacionValida, vaccineCatalogId: undefined })
        .success,
    ).toBe(false);
    expect(
      recordVaccinationSchema.safeParse({
        ...aplicacionValida,
        vaccineCatalogId: undefined,
        vaccineName: "Séxtuple canina",
      }).success,
    ).toBe(true);
  });

  it("exige lote o justificación de su ausencia", () => {
    expect(
      recordVaccinationSchema.safeParse({ ...aplicacionValida, lotNumber: undefined }).success,
    ).toBe(false);
    expect(
      recordVaccinationSchema.safeParse({
        ...aplicacionValida,
        lotNumber: undefined,
        lotMissingReason: "Empaque sin etiqueta; autorizado por dirección",
      }).success,
    ).toBe(true);
  });

  it("el lote exige caducidad", () => {
    expect(
      recordVaccinationSchema.safeParse({ ...aplicacionValida, expirationDate: undefined }).success,
    ).toBe(false);
  });

  it("exige idempotency key (requestId) contra doble clic", () => {
    expect(
      recordVaccinationSchema.safeParse({ ...aplicacionValida, requestId: undefined }).success,
    ).toBe(false);
  });
});

describe("recordHistoricalVaccinationSchema (registro aportado)", () => {
  const historicoValido = {
    clinicId: uuid,
    petId: uuid2,
    source: "historical_owner_document",
    vaccineName: "Rabia",
    administeredOn: "2025-11-02",
    requestId: uuid,
  };

  it("acepta un histórico mínimo con fuente explícita", () => {
    expect(recordHistoricalVaccinationSchema.safeParse(historicoValido).success).toBe(true);
  });

  it("rechaza la fuente administered_in_clinic (flujo separado)", () => {
    expect(
      recordHistoricalVaccinationSchema.safeParse({
        ...historicoValido,
        source: "administered_in_clinic",
      }).success,
    ).toBe(false);
  });

  it("rechaza un histórico sin fuente", () => {
    expect(
      recordHistoricalVaccinationSchema.safeParse({ ...historicoValido, source: undefined })
        .success,
    ).toBe(false);
  });

  it("la próxima dosis debe ser posterior a la aplicación", () => {
    expect(
      recordHistoricalVaccinationSchema.safeParse({
        ...historicoValido,
        nextDueAt: "2025-10-01",
      }).success,
    ).toBe(false);
    expect(
      recordHistoricalVaccinationSchema.safeParse({
        ...historicoValido,
        nextDueAt: "2026-11-02",
      }).success,
    ).toBe(true);
  });

  it("rechaza fechas con formato inválido", () => {
    expect(
      recordHistoricalVaccinationSchema.safeParse({
        ...historicoValido,
        administeredOn: "02/11/2025",
      }).success,
    ).toBe(false);
  });
});

describe("vaccineCatalogSchema", () => {
  it("acepta un producto con intervalo de refuerzo como AYUDA editable", () => {
    const r = vaccineCatalogSchema.safeParse({
      name: "Séxtuple canina",
      targetSpecies: ["dog"],
      diseasesCovered: ["Moquillo", "Parvovirus"],
      defaultBoosterIntervalDays: 365,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza intervalos imposibles", () => {
    expect(
      vaccineCatalogSchema.safeParse({ name: "X", defaultBoosterIntervalDays: 0 }).success,
    ).toBe(false);
  });
});

describe("voidVaccinationSchema", () => {
  it("exige motivo", () => {
    expect(voidVaccinationSchema.safeParse({ recordId: uuid, reason: " " }).success).toBe(false);
    expect(
      voidVaccinationSchema.safeParse({ recordId: uuid, reason: "Registro duplicado" }).success,
    ).toBe(true);
  });
});
