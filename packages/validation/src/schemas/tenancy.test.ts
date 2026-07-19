import { describe, expect, it } from "vitest";

import {
  changeClinicMemberRoleSchema,
  createClinicSchema,
  createOrganizationSchema,
  inviteClinicMemberSchema,
  postalCodeMxSchema,
  profileSchema,
  rfcSchema,
} from "../index";

const UUID = "3f9a1c1e-2b7d-4a56-9f31-0d9d3a6b1c22";

describe("createOrganizationSchema", () => {
  it("acepta datos válidos y normaliza el RFC a mayúsculas", () => {
    const result = createOrganizationSchema.parse({
      name: "  Veterinaria Luna  ",
      slug: "Veterinaria-Luna",
      taxId: "vlu240101ab1",
    });
    expect(result.name).toBe("Veterinaria Luna");
    expect(result.slug).toBe("veterinaria-luna");
    expect(result.taxId).toBe("VLU240101AB1");
  });

  it("rechaza el nombre vacío (campo obligatorio)", () => {
    expect(createOrganizationSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rechaza nombres que exceden 120 caracteres", () => {
    expect(createOrganizationSchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
  });

  it("rechaza slugs inválidos", () => {
    expect(createOrganizationSchema.safeParse({ name: "Vet", slug: "con espacios" }).success).toBe(
      false,
    );
  });

  it("rechaza un RFC de longitud incorrecta", () => {
    expect(createOrganizationSchema.safeParse({ name: "Vet", taxId: "ABC" }).success).toBe(false);
  });
});

describe("createClinicSchema", () => {
  const base = { organizationId: UUID, name: "Clínica Centro" };

  it("acepta una clínica válida con defaults correctos", () => {
    const result = createClinicSchema.parse(base);
    expect(result.timezone).toBe("America/Mexico_City");
  });

  it("normaliza el correo a minúsculas", () => {
    const result = createClinicSchema.parse({ ...base, email: "Contacto@Clinica.MX" });
    expect(result.email).toBe("contacto@clinica.mx");
  });

  it("rechaza un organizationId que no es uuid", () => {
    expect(createClinicSchema.safeParse({ ...base, organizationId: "123" }).success).toBe(false);
  });

  it("rechaza teléfonos sin formato mexicano razonable", () => {
    expect(createClinicSchema.safeParse({ ...base, phone: "5512345678" }).success).toBe(false);
    expect(createClinicSchema.parse({ ...base, phone: "+52 55 1234 5678" }).phone).toBe(
      "+525512345678",
    );
  });

  it("rechaza códigos postales que no son de 5 dígitos", () => {
    expect(createClinicSchema.safeParse({ ...base, postalCode: "123" }).success).toBe(false);
    expect(createClinicSchema.safeParse({ ...base, postalCode: "0610A" }).success).toBe(false);
    expect(createClinicSchema.parse({ ...base, postalCode: "06100" }).postalCode).toBe("06100");
  });
});

describe("inviteClinicMemberSchema", () => {
  it("acepta una invitación válida y normaliza el correo", () => {
    const result = inviteClinicMemberSchema.parse({
      clinicId: UUID,
      email: " Nueva@Ejemplo.MX ",
      role: "receptionist",
    });
    expect(result.email).toBe("nueva@ejemplo.mx");
  });

  it("rechaza roles que no existen en la base de datos", () => {
    const result = inviteClinicMemberSchema.safeParse({
      clinicId: UUID,
      email: "a@b.mx",
      role: "superdoctor",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Selecciona un rol de clínica válido.");
    }
  });
});

describe("changeClinicMemberRoleSchema", () => {
  it("acepta los cuatro roles de clínica derivados de la base", () => {
    for (const role of ["clinic_admin", "veterinarian", "receptionist", "assistant"] as const) {
      expect(changeClinicMemberRoleSchema.safeParse({ memberId: UUID, role }).success).toBe(true);
    }
  });

  it("rechaza estados o roles inválidos", () => {
    expect(changeClinicMemberRoleSchema.safeParse({ memberId: UUID, role: "owner" }).success).toBe(
      false,
    );
  });
});

describe("profileSchema", () => {
  it("acepta un perfil válido con defaults es-MX", () => {
    const result = profileSchema.parse({ displayName: "Ana A.", phone: "+52 55 0000 0000" });
    expect(result.preferredLocale).toBe("es-MX");
    expect(result.timezone).toBe("America/Mexico_City");
    expect(result.phone).toBe("+525500000000");
  });

  it("rechaza nombres que exceden la longitud máxima", () => {
    expect(profileSchema.safeParse({ firstName: "a".repeat(101) }).success).toBe(false);
  });

  it("rechaza avatares que no son URL", () => {
    expect(profileSchema.safeParse({ avatarUrl: "no-es-url" }).success).toBe(false);
  });
});

describe("postalCodeMxSchema / rfcSchema", () => {
  it.each(["00000", "06100", "99999"])("acepta el código postal %s", (cp) => {
    expect(postalCodeMxSchema.safeParse(cp).success).toBe(true);
  });

  it.each(["1234", "123456", "ABCDE"])("rechaza el código postal %s", (cp) => {
    expect(postalCodeMxSchema.safeParse(cp).success).toBe(false);
  });

  it("acepta RFC de persona física (13) y moral (12)", () => {
    expect(rfcSchema.safeParse("GODE561231GR8").success).toBe(true);
    expect(rfcSchema.safeParse("VLU240101AB1").success).toBe(true);
  });
});
