import { describe, expect, it } from "vitest";

import {
  acceptPortalInvitationSchema,
  publicBookingSchema,
  publicSearchSchema,
  vetPublicProfileSchema,
} from "./portal";

const uuid = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

const reservaValida = {
  clinicSlug: "clinica-luna-centro",
  serviceId: uuid,
  veterinarianMemberId: uuid,
  start: "2027-03-01T12:00:00-06:00",
  firstName: "Carla",
  lastName: "Invitada",
  email: "carla@ejemplo.mx",
  petName: "Bombón",
  petSpecies: "dog",
  requestId: uuid,
};

describe("publicBookingSchema (reserva de invitado)", () => {
  it("acepta una reserva mínima válida", () => {
    expect(publicBookingSchema.safeParse(reservaValida).success).toBe(true);
  });

  it("exige contacto e idempotency key", () => {
    expect(publicBookingSchema.safeParse({ ...reservaValida, email: "no-es-correo" }).success).toBe(
      false,
    );
    expect(publicBookingSchema.safeParse({ ...reservaValida, requestId: undefined }).success).toBe(
      false,
    );
  });

  it("teléfono opcional pero en formato internacional", () => {
    expect(publicBookingSchema.safeParse({ ...reservaValida, phone: "5512345678" }).success).toBe(
      false,
    );
    expect(
      publicBookingSchema.safeParse({ ...reservaValida, phone: "+525512345678" }).success,
    ).toBe(true);
  });

  it("rechaza slugs manipulados", () => {
    expect(
      publicBookingSchema.safeParse({ ...reservaValida, clinicSlug: "x; drop table" }).success,
    ).toBe(false);
  });
});

describe("vetPublicProfileSchema", () => {
  it("normaliza el slug y exige formato", () => {
    const r = vetPublicProfileSchema.safeParse({ slug: "Dr-Vet-Luna" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slug).toBe("dr-vet-luna");
    expect(vetPublicProfileSchema.safeParse({ slug: "a" }).success).toBe(false);
  });
});

describe("acceptPortalInvitationSchema", () => {
  it("solo acepta tokens hex de 64", () => {
    expect(acceptPortalInvitationSchema.safeParse({ token: "abc" }).success).toBe(false);
    expect(acceptPortalInvitationSchema.safeParse({ token: "a".repeat(64) }).success).toBe(true);
  });
});

describe("publicSearchSchema", () => {
  it("acepta filtros vacíos con paginación por defecto", () => {
    const r = publicSearchSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.page).toBe(1);
  });

  it.each(["", "   ", "\t\n"])("normaliza filtros vacíos (%j) como ausentes", (valor) => {
    expect(publicSearchSchema.parse({ q: valor, ciudad: valor, categoria: valor })).toEqual({
      q: undefined,
      ciudad: undefined,
      categoria: undefined,
      page: 1,
    });
  });

  it("recorta texto y conserva los filtros al elegir todas las categorías", () => {
    expect(
      publicSearchSchema.parse({ q: "  Luna  ", ciudad: "  Monterrey  ", categoria: "" }),
    ).toEqual({ q: "Luna", ciudad: "Monterrey", categoria: undefined, page: 1 });
  });

  it("rechaza categorías desconocidas y texto demasiado largo", () => {
    expect(publicSearchSchema.safeParse({ categoria: "inexistente" }).success).toBe(false);
    expect(publicSearchSchema.safeParse({ q: "a".repeat(121) }).success).toBe(false);
    expect(publicSearchSchema.safeParse({ ciudad: "a".repeat(121) }).success).toBe(false);
  });
});
