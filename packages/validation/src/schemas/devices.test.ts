import { describe, expect, it } from "vitest";

import { registerDeviceTokenSchema, unregisterDeviceTokenSchema } from "./devices";

describe("registerDeviceTokenSchema", () => {
  it("acepta un token válido con plataforma soportada", () => {
    const r = registerDeviceTokenSchema.safeParse({
      token: "  fcm-token-abcdefghij  ",
      platform: "android",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.token).toBe("fcm-token-abcdefghij");
  });

  it("rechaza un token demasiado corto", () => {
    const r = registerDeviceTokenSchema.safeParse({ token: "corto", platform: "ios" });
    expect(r.success).toBe(false);
  });

  it("rechaza una plataforma no soportada", () => {
    const r = registerDeviceTokenSchema.safeParse({
      token: "fcm-token-abcdefghij",
      platform: "windows",
    });
    expect(r.success).toBe(false);
  });

  it("acepta las tres plataformas soportadas", () => {
    for (const platform of ["ios", "android", "web"] as const) {
      expect(
        registerDeviceTokenSchema.safeParse({ token: "fcm-token-abcdefghij", platform }).success,
      ).toBe(true);
    }
  });
});

describe("unregisterDeviceTokenSchema", () => {
  it("acepta un token válido", () => {
    expect(unregisterDeviceTokenSchema.safeParse({ token: "fcm-token-abcdefghij" }).success).toBe(
      true,
    );
  });

  it("rechaza un token vacío", () => {
    expect(unregisterDeviceTokenSchema.safeParse({ token: "" }).success).toBe(false);
  });
});
