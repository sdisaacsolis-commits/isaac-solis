import { describe, expect, it } from "vitest";

import { iniciarCheckoutSchema, planCodeSchema } from "./billing";

describe("planCodeSchema", () => {
  it("acepta los planes comerciales", () => {
    expect(planCodeSchema.parse("profesional")).toBe("profesional");
    expect(planCodeSchema.parse("profesional_anual")).toBe("profesional_anual");
  });

  it("rechaza planes fuera del catálogo contratable (beta incluido)", () => {
    expect(planCodeSchema.safeParse("beta").success).toBe(false);
    expect(planCodeSchema.safeParse("").success).toBe(false);
    expect(planCodeSchema.safeParse("vip").success).toBe(false);
  });
});

describe("iniciarCheckoutSchema", () => {
  it("acepta una clínica y un plan válidos", () => {
    const resultado = iniciarCheckoutSchema.safeParse({
      clinicId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      planCode: "profesional",
    });
    expect(resultado.success).toBe(true);
  });

  it("rechaza identificadores que no son UUID", () => {
    const resultado = iniciarCheckoutSchema.safeParse({
      clinicId: "1; drop table subscriptions;",
      planCode: "profesional",
    });
    expect(resultado.success).toBe(false);
  });

  it("rechaza la ausencia de plan", () => {
    const resultado = iniciarCheckoutSchema.safeParse({
      clinicId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    });
    expect(resultado.success).toBe(false);
  });
});
