import { beforeEach, describe, expect, it, vi } from "vitest";

import { registrarse } from "./actions";

const { signUp, redirect } = vi.hoisted(() => ({ signUp: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://app.example" } }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ auth: { signUp } }) }));

const prev = { ok: false };
function formulario(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    firstName: "Ana",
    lastName: "Aguilar",
    email: "ANA@ejemplo.mx",
    password: "Segura2026",
    acceptTerms: "on",
    ...overrides,
  })) {
    form.set(key, value);
  }
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  signUp.mockResolvedValue({ data: { session: null }, error: null });
});

describe("registro público", () => {
  it("valida una sola contraseña y mantiene el onboarding por defecto", async () => {
    const result = await registrarse(prev, formulario());
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Segura2026");
    expect(signUp).toHaveBeenCalledWith({
      email: "ana@ejemplo.mx",
      password: "Segura2026",
      options: {
        data: { display_name: "Ana Aguilar", first_name: "Ana", last_name: "Aguilar" },
        emailRedirectTo: "https://app.example/confirmar?next=%2Fapp%2Fonboarding",
      },
    });
  });

  it.each(["/invitaciones/", "/portal/invitacion/"])(
    "conserva el retorno seguro a %s",
    async (prefix) => {
      const destino = prefix + "a".repeat(64);
      await registrarse(prev, formulario({ next: destino }));
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo: "https://app.example/confirmar?next=" + encodeURIComponent(destino),
          }),
        }),
      );
    },
  );

  it("no intenta registrar sin consentimiento o con contraseña débil", async () => {
    const result = await registrarse(prev, formulario({ acceptTerms: "", password: "débil" }));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.acceptTerms).toHaveLength(1);
    expect(result.fieldErrors?.password).toBeDefined();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("no expone cuentas existentes ni permite un retorno externo", async () => {
    const form = formulario({ next: "//example.net" });
    const regular = await registrarse(prev, form);
    signUp.mockResolvedValue({ data: {}, error: { code: "user_already_exists" } });
    expect(await registrarse(prev, form)).toEqual(regular);
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "https://app.example/confirmar?next=%2Fapp%2Fonboarding",
        }),
      }),
    );
  });
});
