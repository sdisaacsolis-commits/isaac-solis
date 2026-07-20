import { describe, expect, it } from "vitest";

import { formatearPrecioMXN, hoyEnZona, localAUtc, sumarDias, utcALocalInput } from "./dates";

const TZ = "America/Mexico_City"; // UTC-6 todo el año desde 2022

describe("localAUtc", () => {
  it("convierte hora local de la clínica a UTC", () => {
    expect(localAUtc("2027-03-01T10:00", TZ).toISOString()).toBe("2027-03-01T16:00:00.000Z");
  });

  it("respeta zonas con horario de verano (bordes DST)", () => {
    // Nueva York: 12:00 EST = 17:00Z; 12:00 EDT = 16:00Z.
    expect(localAUtc("2027-01-15T12:00", "America/New_York").toISOString()).toBe(
      "2027-01-15T17:00:00.000Z",
    );
    expect(localAUtc("2027-07-15T12:00", "America/New_York").toISOString()).toBe(
      "2027-07-15T16:00:00.000Z",
    );
  });
});

describe("utcALocalInput", () => {
  it("es inversa de localAUtc", () => {
    expect(utcALocalInput("2027-03-01T16:00:00Z", TZ)).toBe("2027-03-01T10:00");
  });

  it("cruza medianoche correctamente", () => {
    expect(utcALocalInput("2027-03-02T03:30:00Z", TZ)).toBe("2027-03-01T21:30");
  });
});

describe("hoyEnZona / sumarDias", () => {
  it("calcula el día local aunque UTC ya sea mañana", () => {
    expect(hoyEnZona(TZ, new Date("2027-03-02T04:00:00Z"))).toBe("2027-03-01");
  });

  it("suma días de calendario", () => {
    expect(sumarDias("2027-02-27", 2)).toBe("2027-03-01");
    expect(sumarDias("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("formatearPrecioMXN", () => {
  it("presenta centavos como pesos", () => {
    expect(formatearPrecioMXN(35000)).toMatch(/350/);
    expect(formatearPrecioMXN(19990)).toMatch(/199\.90/);
  });
});
