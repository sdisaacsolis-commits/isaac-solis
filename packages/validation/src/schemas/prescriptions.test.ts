import { describe, expect, it } from "vitest";

import {
  issuePrescriptionSchema,
  prescriptionItemSchema,
  supersedePrescriptionSchema,
  updatePrescriptionDraftSchema,
  voidPrescriptionSchema,
} from "./prescriptions";

const uuid = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

const partidaValida = {
  prescriptionId: uuid,
  position: 1,
  medicationName: "Amoxicilina suspensión",
  dosageText: "12 mg/kg",
  routeText: "Oral",
  frequencyText: "Cada 12 horas",
  durationText: "10 días",
};

describe("prescriptionItemSchema", () => {
  it("acepta una partida completa capturada por el veterinario", () => {
    const r = prescriptionItemSchema.safeParse(partidaValida);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.asNeeded).toBe(false);
  });

  it("rechaza un medicamento sin nombre", () => {
    expect(
      prescriptionItemSchema.safeParse({ ...partidaValida, medicationName: "  " }).success,
    ).toBe(false);
  });

  it("rechaza dosis vacía (la dosis SIEMPRE la escribe el veterinario)", () => {
    expect(prescriptionItemSchema.safeParse({ ...partidaValida, dosageText: "" }).success).toBe(
      false,
    );
  });

  it("rechaza frecuencia y duración vacías", () => {
    expect(prescriptionItemSchema.safeParse({ ...partidaValida, frequencyText: "" }).success).toBe(
      false,
    );
    expect(prescriptionItemSchema.safeParse({ ...partidaValida, durationText: " " }).success).toBe(
      false,
    );
  });

  it("rechaza campos demasiado largos", () => {
    expect(
      prescriptionItemSchema.safeParse({ ...partidaValida, dosageText: "x".repeat(301) }).success,
    ).toBe(false);
  });

  it("rechaza fin de tratamiento anterior al inicio", () => {
    expect(
      prescriptionItemSchema.safeParse({
        ...partidaValida,
        startDate: "2026-08-10",
        endDate: "2026-08-01",
      }).success,
    ).toBe(false);
  });

  it("rechaza posiciones fuera de rango", () => {
    expect(prescriptionItemSchema.safeParse({ ...partidaValida, position: 0 }).success).toBe(false);
    expect(prescriptionItemSchema.safeParse({ ...partidaValida, position: 201 }).success).toBe(
      false,
    );
  });
});

describe("emisión, sustitución y anulación", () => {
  it("la emisión exige confirmación explícita", () => {
    expect(issuePrescriptionSchema.safeParse({ prescriptionId: uuid, confirm: true }).success).toBe(
      true,
    );
    expect(
      issuePrescriptionSchema.safeParse({ prescriptionId: uuid, confirm: false }).success,
    ).toBe(false);
  });

  it("la sustitución exige motivo", () => {
    expect(
      supersedePrescriptionSchema.safeParse({ prescriptionId: uuid, reason: " " }).success,
    ).toBe(false);
    expect(
      supersedePrescriptionSchema.safeParse({ prescriptionId: uuid, reason: "Dosis corregida" })
        .success,
    ).toBe(true);
  });

  it("la anulación exige motivo", () => {
    expect(voidPrescriptionSchema.safeParse({ prescriptionId: uuid, reason: "" }).success).toBe(
      false,
    );
  });

  it("los ids manipulados se rechazan", () => {
    expect(
      voidPrescriptionSchema.safeParse({ prescriptionId: "1; drop table", reason: "Motivo real" })
        .success,
    ).toBe(false);
  });
});

describe("updatePrescriptionDraftSchema (concurrencia optimista)", () => {
  it("exige versión esperada válida", () => {
    expect(
      updatePrescriptionDraftSchema.safeParse({ prescriptionId: uuid, expectedVersion: 0 }).success,
    ).toBe(false);
    expect(
      updatePrescriptionDraftSchema.safeParse({ prescriptionId: uuid, expectedVersion: 3 }).success,
    ).toBe(true);
  });

  it("valida la vigencia como fecha ISO", () => {
    expect(
      updatePrescriptionDraftSchema.safeParse({
        prescriptionId: uuid,
        expectedVersion: 1,
        validUntil: "10/08/2026",
      }).success,
    ).toBe(false);
  });
});
