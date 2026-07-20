import { describe, expect, it } from "vitest";

import {
  etiquetasRolClinica,
  puedeAdministrarClinica,
  puedeAdministrarOrganizacion,
  puedeEditarOrganizacion,
} from "./roles";

describe("ayudas de permisos de presentación", () => {
  it("owner y admin administran la organización; billing y member no", () => {
    expect(puedeAdministrarOrganizacion("owner")).toBe(true);
    expect(puedeAdministrarOrganizacion("admin")).toBe(true);
    expect(puedeAdministrarOrganizacion("billing")).toBe(false);
    expect(puedeAdministrarOrganizacion("member")).toBe(false);
    expect(puedeAdministrarOrganizacion(null)).toBe(false);
  });

  it("solo el owner edita la identidad de la organización", () => {
    expect(puedeEditarOrganizacion("owner")).toBe(true);
    expect(puedeEditarOrganizacion("admin")).toBe(false);
  });

  it("clinic_admin administra su clínica aunque sea member de la organización", () => {
    expect(puedeAdministrarClinica("member", "clinic_admin")).toBe(true);
    expect(puedeAdministrarClinica("member", "veterinarian")).toBe(false);
    expect(puedeAdministrarClinica("admin", null)).toBe(true);
  });

  it("las etiquetas de roles de clínica están completas", () => {
    expect(Object.keys(etiquetasRolClinica)).toHaveLength(4);
  });
});
