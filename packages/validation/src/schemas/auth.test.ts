import { describe, expect, it } from "vitest";

import {
  invitationTokenSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  safeInternalPathSchema,
  updatePasswordSchema,
} from "../index";

const validRegister = {
  firstName: "Ana",
  lastName: "Aguilar",
  email: "Ana@Ejemplo.MX",
  password: "segura123",
  confirmPassword: "segura123",
  acceptTerms: true as const,
};

describe("registerSchema", () => {
  it("acepta un registro válido y normaliza el correo", () => {
    const result = registerSchema.parse(validRegister);
    expect(result.email).toBe("ana@ejemplo.mx");
  });

  it("rechaza contraseñas que no coinciden", () => {
    const result = registerSchema.safeParse({ ...validRegister, confirmPassword: "otra123x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Las contraseñas no coinciden.");
    }
  });

  it("rechaza el registro sin aceptar términos", () => {
    expect(registerSchema.safeParse({ ...validRegister, acceptTerms: false }).success).toBe(false);
  });

  it("rechaza nombre o apellido vacíos", () => {
    expect(registerSchema.safeParse({ ...validRegister, firstName: "  " }).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it.each(["corta1", "solocaracteres", "12345678"])("rechaza la contraseña débil %s", (pwd) => {
    expect(passwordSchema.safeParse(pwd).success).toBe(false);
  });

  it("rechaza contraseñas de más de 72 caracteres", () => {
    expect(passwordSchema.safeParse(`a1${"x".repeat(71)}`).success).toBe(false);
  });

  it("acepta una contraseña razonable", () => {
    expect(passwordSchema.safeParse("patitas2026").success).toBe(true);
  });
});

describe("loginSchema / updatePasswordSchema", () => {
  it("exige correo y contraseña presentes", () => {
    expect(loginSchema.safeParse({ email: "a@b.mx", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.mx", password: "x" }).success).toBe(true);
  });

  it("rechaza actualización con contraseñas distintas", () => {
    expect(
      updatePasswordSchema.safeParse({ password: "segura123", confirmPassword: "segura124" })
        .success,
    ).toBe(false);
  });
});

describe("invitationTokenSchema", () => {
  it("acepta un token hex de 64 caracteres", () => {
    expect(invitationTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
  });

  it.each(["A".repeat(64), "z".repeat(64), "abc", `${"a".repeat(63)}!`])(
    "rechaza el token inválido %s",
    (token) => {
      expect(invitationTokenSchema.safeParse(token).success).toBe(false);
    },
  );
});

describe("safeInternalPathSchema (anti open-redirect)", () => {
  it.each(["/app/inicio", "/invitaciones/abc", "/", "/app/personal?x=1"])(
    "acepta la ruta interna %s",
    (path) => {
      expect(safeInternalPathSchema.safeParse(path).success).toBe(true);
    },
  );

  it.each([
    "//evil.mx",
    "https://evil.mx",
    "http://evil.mx/app",
    "javascript:alert(1)",
    "\\\\evil",
    "/app\\..\\x",
    "app/inicio",
    "",
  ])("rechaza la ruta manipulada %s", (path) => {
    expect(safeInternalPathSchema.safeParse(path).success).toBe(false);
  });
});
