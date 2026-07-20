import { describe, expect, it } from "vitest";

import {
  appointmentFolioSchema,
  availabilityQuerySchema,
  bookAppointmentSchema,
  cancelAppointmentSchema,
  configureScheduleSchema,
  createServiceSchema,
  localDateTimeSchema,
  precioPesosSchema,
  scheduleExceptionSchema,
  scheduleSlotSchema,
  timeOfDaySchema,
} from "./appointments";

const uuid = "3f0e8c9a-1b2d-4c5e-8f7a-9b0c1d2e3f4a";

describe("timeOfDaySchema / localDateTimeSchema", () => {
  it("acepta horas válidas y rechaza inválidas", () => {
    expect(timeOfDaySchema.safeParse("09:00").success).toBe(true);
    expect(timeOfDaySchema.safeParse("23:59").success).toBe(true);
    expect(timeOfDaySchema.safeParse("24:00").success).toBe(false);
    expect(timeOfDaySchema.safeParse("9:00").success).toBe(false);
  });

  it("valida datetime-local", () => {
    expect(localDateTimeSchema.safeParse("2027-03-01T10:30").success).toBe(true);
    expect(localDateTimeSchema.safeParse("2027-03-01 10:30").success).toBe(false);
    expect(localDateTimeSchema.safeParse("2027-03-01T25:00").success).toBe(false);
  });
});

describe("precioPesosSchema", () => {
  it("convierte pesos a centavos (enteros)", () => {
    expect(precioPesosSchema.parse("350")).toBe(35000);
    expect(precioPesosSchema.parse("199.9")).toBe(19990);
    expect(precioPesosSchema.parse(0)).toBe(0);
  });

  it("rechaza negativos", () => {
    expect(precioPesosSchema.safeParse(-1).success).toBe(false);
  });
});

describe("createServiceSchema", () => {
  const base = {
    clinicId: uuid,
    name: "Consulta general",
    category: "consultation",
    durationMinutes: "30",
    priceCents: "350",
  };

  it("acepta un servicio válido con defaults", () => {
    const r = createServiceSchema.parse(base);
    expect(r.priceCents).toBe(35000);
    expect(r.bufferBeforeMinutes).toBe(0);
    expect(r.requiresVeterinarian).toBe(true);
  });

  it("rechaza duraciones fuera de rango y categorías inválidas", () => {
    expect(createServiceSchema.safeParse({ ...base, durationMinutes: "3" }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...base, durationMinutes: "500" }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...base, category: "spa" }).success).toBe(false);
  });
});

describe("scheduleSlotSchema / configureScheduleSchema", () => {
  it("exige inicio antes del fin", () => {
    expect(
      scheduleSlotSchema.safeParse({ weekday: 1, startTime: "09:00", endTime: "14:00" }).success,
    ).toBe(true);
    expect(
      scheduleSlotSchema.safeParse({ weekday: 1, startTime: "14:00", endTime: "09:00" }).success,
    ).toBe(false);
  });

  it("acepta lista vacía (borrar horario) y rechaza días inválidos", () => {
    expect(
      configureScheduleSchema.safeParse({ clinicId: uuid, clinicMemberId: uuid, slots: [] })
        .success,
    ).toBe(true);
    expect(
      configureScheduleSchema.safeParse({
        clinicId: uuid,
        clinicMemberId: uuid,
        slots: [{ weekday: 0, startTime: "09:00", endTime: "10:00" }],
      }).success,
    ).toBe(false);
  });
});

describe("scheduleExceptionSchema", () => {
  const base = {
    clinicId: uuid,
    type: "vacation",
    startsAt: "2027-04-05T00:00",
    endsAt: "2027-04-10T00:00",
  };

  it("acepta excepciones válidas", () => {
    expect(scheduleExceptionSchema.safeParse(base).success).toBe(true);
  });

  it("special_hours exige persona", () => {
    expect(scheduleExceptionSchema.safeParse({ ...base, type: "special_hours" }).success).toBe(
      false,
    );
    expect(
      scheduleExceptionSchema.safeParse({ ...base, type: "special_hours", clinicMemberId: uuid })
        .success,
    ).toBe(true);
  });

  it("rechaza rangos invertidos", () => {
    expect(scheduleExceptionSchema.safeParse({ ...base, endsAt: "2027-04-01T00:00" }).success).toBe(
      false,
    );
  });
});

describe("bookAppointmentSchema", () => {
  const base = {
    clinicId: uuid,
    petId: uuid,
    ownerId: uuid,
    veterinarianMemberId: uuid,
    serviceIds: [uuid],
    start: "2027-03-01T10:00",
    source: "staff",
  };

  it("acepta una cita válida", () => {
    expect(bookAppointmentSchema.safeParse(base).success).toBe(true);
  });

  it("exige al menos un servicio y máximo 10", () => {
    expect(bookAppointmentSchema.safeParse({ ...base, serviceIds: [] }).success).toBe(false);
    expect(
      bookAppointmentSchema.safeParse({ ...base, serviceIds: Array(11).fill(uuid) }).success,
    ).toBe(false);
  });

  it("una urgencia requiere motivo", () => {
    expect(bookAppointmentSchema.safeParse({ ...base, emergency: true }).success).toBe(false);
    expect(
      bookAppointmentSchema.safeParse({
        ...base,
        emergency: true,
        emergencyReason: "Atropellamiento",
      }).success,
    ).toBe(true);
  });

  it("solo admite orígenes operables por personal", () => {
    expect(bookAppointmentSchema.safeParse({ ...base, source: "owner_portal" }).success).toBe(
      false,
    );
  });
});

describe("cancelAppointmentSchema", () => {
  it("el motivo es obligatorio y no vacío", () => {
    expect(cancelAppointmentSchema.safeParse({ appointmentId: uuid, reason: "  " }).success).toBe(
      false,
    );
    expect(
      cancelAppointmentSchema.safeParse({ appointmentId: uuid, reason: "No puede asistir" })
        .success,
    ).toBe(true);
  });
});

describe("availabilityQuerySchema", () => {
  const base = {
    clinicId: uuid,
    veterinarianMemberId: uuid,
    serviceId: uuid,
    fromDate: "2027-03-01",
    toDate: "2027-03-08",
  };

  it("acepta rangos de hasta 31 días", () => {
    expect(availabilityQuerySchema.safeParse(base).success).toBe(true);
    expect(availabilityQuerySchema.safeParse({ ...base, toDate: "2027-04-01" }).success).toBe(true);
  });

  it("rechaza rangos invertidos o mayores a 31 días", () => {
    expect(availabilityQuerySchema.safeParse({ ...base, toDate: "2027-02-01" }).success).toBe(
      false,
    );
    expect(availabilityQuerySchema.safeParse({ ...base, toDate: "2027-05-01" }).success).toBe(
      false,
    );
  });
});

describe("appointmentFolioSchema", () => {
  it("valida el formato CIT-AAAA-NNNNNN", () => {
    expect(appointmentFolioSchema.safeParse("CIT-2026-000123").success).toBe(true);
    expect(appointmentFolioSchema.safeParse("CIT-26-000123").success).toBe(false);
    expect(appointmentFolioSchema.safeParse("FAC-2026-000123").success).toBe(false);
  });
});
