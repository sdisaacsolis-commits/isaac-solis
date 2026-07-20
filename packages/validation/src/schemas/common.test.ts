import { describe, expect, it } from "vitest";

import { clinicSlugSchema, emailSchema, nonEmptyTextSchema, phoneMxSchema } from "../index";

describe("emailSchema", () => {
  it("acepta un correo válido y lo normaliza a minúsculas", () => {
    expect(emailSchema.parse("  Duena@Ejemplo.MX ")).toBe("duena@ejemplo.mx");
  });

  it("rechaza un correo inválido con mensaje en español", () => {
    const result = emailSchema.safeParse("no-es-correo");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Ingresa un correo electrónico válido.");
    }
  });
});

describe("phoneMxSchema", () => {
  it("acepta y normaliza un teléfono mexicano con separadores", () => {
    expect(phoneMxSchema.parse("+52 (55) 1234-5678")).toBe("+525512345678");
  });

  it("rechaza un teléfono sin lada de país", () => {
    expect(phoneMxSchema.safeParse("5512345678").success).toBe(false);
  });

  it("rechaza un teléfono con menos de 10 dígitos", () => {
    expect(phoneMxSchema.safeParse("+52123").success).toBe(false);
  });
});

describe("nonEmptyTextSchema", () => {
  it("recorta espacios y acepta texto válido", () => {
    expect(nonEmptyTextSchema.parse("  Clínica Patitas  ")).toBe("Clínica Patitas");
  });

  it("rechaza cadenas vacías o solo espacios", () => {
    expect(nonEmptyTextSchema.safeParse("   ").success).toBe(false);
  });
});

describe("clinicSlugSchema", () => {
  it("acepta slugs válidos", () => {
    expect(clinicSlugSchema.parse("clinica-patitas-condesa")).toBe("clinica-patitas-condesa");
  });

  it("normaliza mayúsculas a minúsculas antes de validar", () => {
    expect(clinicSlugSchema.parse("Clinica-Patitas")).toBe("clinica-patitas");
  });

  it.each(["-empieza-con-guion", "termina-con-guion-", "doble--guion", "con espacios", "ab"])(
    "rechaza el slug inválido %s",
    (slug) => {
      expect(clinicSlugSchema.safeParse(slug).success).toBe(false);
    },
  );
});
