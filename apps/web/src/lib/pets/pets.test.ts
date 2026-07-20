import { describe, expect, it } from "vitest";

import {
  calcularEdad,
  escaparBusqueda,
  etiquetasEspecie,
  etiquetasSexo,
  nombrePropietario,
} from "./format";
import { ALLOWED_PET_PHOTO_MIME, esFotoValida, MAX_PET_PHOTO_BYTES } from "./photos-shared";

const HOY = new Date("2026-07-19T12:00:00Z");

describe("calcularEdad", () => {
  it("calcula años y meses", () => {
    expect(calcularEdad("2022-03-01", false, HOY)).toBe("4 años 4 meses");
    expect(calcularEdad("2026-01-19", false, HOY)).toBe("6 meses");
    expect(calcularEdad("2026-07-01", false, HOY)).toBe("menos de un mes");
    expect(calcularEdad("2016-07-01", false, HOY)).toBe("10 años");
  });

  it("marca las fechas aproximadas", () => {
    expect(calcularEdad("2020-01-15", true, HOY)).toBe("aprox. 6 años");
  });

  it("devuelve null sin fecha o con fecha inválida/futura", () => {
    expect(calcularEdad(null, false, HOY)).toBeNull();
    expect(calcularEdad("no-fecha", false, HOY)).toBeNull();
    expect(calcularEdad("2027-01-01", false, HOY)).toBeNull();
  });
});

describe("etiquetas y nombres", () => {
  it("mapea especie y sexo a español", () => {
    expect(etiquetasEspecie.dog).toBe("Perro");
    expect(etiquetasEspecie.cat).toBe("Gato");
    expect(etiquetasSexo.female).toBe("Hembra");
  });

  it("formatea el nombre del propietario con display_name prioritario", () => {
    expect(nombrePropietario({ display_name: "Lau R.", first_name: "Laura", last_name: "R" })).toBe(
      "Lau R.",
    );
    expect(
      nombrePropietario({ display_name: null, first_name: "Laura", last_name: "Ramírez" }),
    ).toBe("Laura Ramírez");
  });
});

describe("escaparBusqueda", () => {
  it("escapa comodines de ILIKE y elimina comas (separador de or())", () => {
    expect(escaparBusqueda("fi%ru_lais\\x")).toBe("fi\\%ru\\_lais\\\\x");
    expect(escaparBusqueda("a,b")).toBe("a b");
  });
});

describe("esFotoValida", () => {
  it("acepta JPEG/PNG/WebP dentro del límite", () => {
    for (const type of ALLOWED_PET_PHOTO_MIME) {
      expect(esFotoValida({ size: 1000, type }).ok).toBe(true);
    }
  });

  it("rechaza SVG, vacíos y archivos grandes", () => {
    expect(esFotoValida({ size: 100, type: "image/svg+xml" }).ok).toBe(false);
    expect(esFotoValida({ size: 0, type: "image/png" }).ok).toBe(false);
    expect(esFotoValida({ size: MAX_PET_PHOTO_BYTES + 1, type: "image/png" }).ok).toBe(false);
  });
});
