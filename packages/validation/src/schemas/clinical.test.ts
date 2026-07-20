import { describe, expect, it } from "vitest";

import {
  addendumSchema,
  vitalsSchema,
  voidEncounterSchema,
  walkInEncounterSchema,
} from "./clinical";

const uuid = "3f0e8c9a-1b2d-4c5e-8f7a-9b0c1d2e3f4a";

describe("vitalsSchema", () => {
  it("rechaza peso cero/negativo y temperaturas imposibles", () => {
    expect(vitalsSchema.safeParse({ encounterId: uuid, weightKg: 0 }).success).toBe(false);
    expect(vitalsSchema.safeParse({ encounterId: uuid, weightKg: -3 }).success).toBe(false);
    expect(vitalsSchema.safeParse({ encounterId: uuid, temperatureC: 80 }).success).toBe(false);
    expect(vitalsSchema.safeParse({ encounterId: uuid, heartRateBpm: -10 }).success).toBe(false);
  });

  it("distingue ausente de cero y acepta valores válidos", () => {
    const r = vitalsSchema.parse({ encounterId: uuid, weightKg: "12.4", painScore: "0" });
    expect(r.weightKg).toBe(12.4);
    expect(r.painScore).toBe(0);
    expect(r.temperatureC).toBeUndefined();
  });
});

describe("addendumSchema / voidEncounterSchema", () => {
  it("exigen motivo", () => {
    expect(addendumSchema.safeParse({ encounterId: uuid, content: "texto" }).success).toBe(false);
    expect(voidEncounterSchema.safeParse({ encounterId: uuid, reason: " " }).success).toBe(false);
    expect(
      voidEncounterSchema.safeParse({ encounterId: uuid, reason: "Paciente equivocado" }).success,
    ).toBe(true);
  });
});

describe("walkInEncounterSchema", () => {
  it("solo admite walk_in o emergency y exige servicio", () => {
    const base = {
      clinicId: uuid,
      petId: uuid,
      ownerId: uuid,
      veterinarianMemberId: uuid,
      serviceIds: [uuid],
      encounterType: "walk_in",
    };
    expect(walkInEncounterSchema.safeParse(base).success).toBe(true);
    expect(walkInEncounterSchema.safeParse({ ...base, encounterType: "scheduled" }).success).toBe(
      false,
    );
    expect(walkInEncounterSchema.safeParse({ ...base, serviceIds: [] }).success).toBe(false);
  });
});
