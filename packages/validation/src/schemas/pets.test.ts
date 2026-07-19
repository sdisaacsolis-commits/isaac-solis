import { describe, expect, it } from "vitest";

import {
  clinicSearchSchema,
  createOwnerSchema,
  createPetSchema,
  microchipSchema,
  petAlertSchema,
  petBirthDateSchema,
  updatePetSchema,
} from "../index";

const UUID = "3f9a1c1e-2b7d-4a56-9f31-0d9d3a6b1c22";

describe("createOwnerSchema", () => {
  it("acepta un propietario válido normalizando correo y teléfono", () => {
    const result = createOwnerSchema.parse({
      firstName: " Laura ",
      lastName: "Ramírez",
      email: "Laura@Ejemplo.MX",
      phone: "+52 (55) 1111-2222",
    });
    expect(result.firstName).toBe("Laura");
    expect(result.email).toBe("laura@ejemplo.mx");
    expect(result.phone).toBe("+525511112222");
    expect(result.preferredContactMethod).toBe("phone");
  });

  it("rechaza nombres vacíos", () => {
    expect(createOwnerSchema.safeParse({ firstName: "  ", lastName: "X" }).success).toBe(false);
  });

  it("rechaza teléfonos y códigos postales inválidos", () => {
    expect(
      createOwnerSchema.safeParse({ firstName: "A", lastName: "B", phone: "5511112222" }).success,
    ).toBe(false);
    expect(
      createOwnerSchema.safeParse({ firstName: "A", lastName: "B", postalCode: "123" }).success,
    ).toBe(false);
  });
});

describe("microchipSchema", () => {
  it("normaliza a mayúsculas sin espacios ni guiones", () => {
    expect(microchipSchema.parse("985 1120-333aa4555")).toBe("9851120333AA4555");
  });

  it.each(["abc", "x".repeat(26), "chip#123"])("rechaza el microchip inválido %s", (chip) => {
    expect(microchipSchema.safeParse(chip).success).toBe(false);
  });
});

describe("petBirthDateSchema", () => {
  it("acepta una fecha pasada válida", () => {
    expect(petBirthDateSchema.safeParse("2022-03-01").success).toBe(true);
  });

  it("rechaza fechas futuras", () => {
    expect(petBirthDateSchema.safeParse("2999-01-01").success).toBe(false);
  });

  it("rechaza fechas incoherentes (antes de 1980) o malformadas", () => {
    expect(petBirthDateSchema.safeParse("1970-01-01").success).toBe(false);
    expect(petBirthDateSchema.safeParse("01/03/2022").success).toBe(false);
    expect(petBirthDateSchema.safeParse("2022-13-45").success).toBe(false);
  });
});

describe("createPetSchema", () => {
  const base = { ownerId: UUID, name: "Firulais", species: "dog" };

  it("acepta una mascota válida con defaults", () => {
    const result = createPetSchema.parse(base);
    expect(result.sex).toBe("unknown");
    expect(result.sterilized).toBe("desconocido");
    expect(result.approximateBirthDate).toBe(false);
  });

  it("acepta fecha aproximada", () => {
    const result = createPetSchema.parse({
      ...base,
      birthDate: "2020-01-15",
      approximateBirthDate: "true",
    });
    expect(result.approximateBirthDate).toBe(true);
  });

  it.each([
    { ...base, species: "dinosaurio" },
    { ...base, sex: "otro" },
    { ...base, ownerId: "123" },
    { ...base, name: "  " },
    { ...base, relationshipType: "duenisimo" },
  ])("rechaza datos inválidos %#", (datos) => {
    expect(createPetSchema.safeParse(datos).success).toBe(false);
  });

  it("updatePetSchema no permite mover la mascota de propietario ni de número interno", () => {
    const parsed = updatePetSchema.parse({
      name: "Rocky",
      ownerId: UUID,
      internalPatientNumber: "X",
    });
    expect("ownerId" in parsed).toBe(false);
    expect("internalPatientNumber" in parsed).toBe(false);
  });
});

describe("petAlertSchema / clinicSearchSchema", () => {
  it("acepta una alerta válida", () => {
    const result = petAlertSchema.parse({
      petId: UUID,
      type: "handling_precaution",
      title: "Usar bozal",
    });
    expect(result.severity).toBe("caution");
  });

  it("rechaza tipos de alerta desconocidos", () => {
    expect(petAlertSchema.safeParse({ petId: UUID, type: "diagnostico", title: "x" }).success).toBe(
      false,
    );
  });

  it("la búsqueda exige términos de al menos 2 caracteres y pagina acotado", () => {
    expect(clinicSearchSchema.safeParse({ q: "a" }).success).toBe(false);
    expect(clinicSearchSchema.parse({ q: "fi", page: "2" }).page).toBe(2);
    expect(clinicSearchSchema.parse({}).page).toBe(1);
    expect(clinicSearchSchema.safeParse({ page: "9999" }).success).toBe(false);
  });
});
