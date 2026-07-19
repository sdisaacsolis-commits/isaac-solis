import { describe, expect, it } from "vitest";

import { DESTINO_POR_DEFECTO, resolveSafeNext } from "./redirects";

describe("resolveSafeNext", () => {
  it("acepta rutas internas", () => {
    expect(resolveSafeNext("/app/personal")).toBe("/app/personal");
    expect(resolveSafeNext("/invitaciones/abc?x=1")).toBe("/invitaciones/abc?x=1");
  });

  it("cae al destino por defecto con valores ausentes o manipulados", () => {
    expect(resolveSafeNext(null)).toBe(DESTINO_POR_DEFECTO);
    expect(resolveSafeNext(undefined)).toBe(DESTINO_POR_DEFECTO);
    expect(resolveSafeNext("https://evil.mx/app")).toBe(DESTINO_POR_DEFECTO);
    expect(resolveSafeNext("//evil.mx")).toBe(DESTINO_POR_DEFECTO);
    expect(resolveSafeNext("javascript:alert(1)")).toBe(DESTINO_POR_DEFECTO);
    expect(resolveSafeNext("app/inicio")).toBe(DESTINO_POR_DEFECTO);
  });

  it("respeta un fallback personalizado", () => {
    expect(resolveSafeNext("://x", "/app/onboarding")).toBe("/app/onboarding");
  });
});
