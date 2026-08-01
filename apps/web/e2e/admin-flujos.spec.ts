import { expect, test } from "@playwright/test";

/**
 * Panel superadmin contra Supabase REAL (local). Verifica la defensa en
 * profundidad: un admin normal NO ve la sección (404 + sin nav), y tras elevar
 * el flag `profiles.is_superadmin` con la SERVICE_ROLE LOCAL (solo CI/local,
 * CLAUDE.md §2; jamás en la app) el usuario ve el Panorama y las clínicas.
 */
const habilitado = process.env.E2E_AUTH === "1" && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function api(ruta: string, init: RequestInit): Promise<unknown> {
  const respuesta = await fetch(`${SUPABASE_URL}${ruta}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  if (!respuesta.ok) {
    throw new Error(`Supabase ${ruta} → ${respuesta.status}: ${await respuesta.text()}`);
  }
  const texto = await respuesta.text();
  return texto ? JSON.parse(texto) : null;
}

/** uid del usuario a partir de su correo (API admin de GoTrue, service role local). */
async function obtenerUid(correo: string): Promise<string> {
  const respuesta = (await api(`/auth/v1/admin/users?per_page=1000`, { method: "GET" })) as {
    users: { id: string; email: string }[];
  };
  const usuario = respuesta.users.find((u) => u.email === correo);
  if (!usuario) throw new Error(`usuario ${correo} no encontrado`);
  return usuario.id;
}

test.describe("Panel superadmin (Supabase local)", () => {
  test.skip(!habilitado, "Requiere Supabase local, E2E_AUTH=1 y SUPABASE_SERVICE_ROLE_KEY local");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const sello = Date.now();
  const correo = `e2e.admin.${sello}@ejemplo.mx`;
  const contrasena = "patitas2026";
  const nombreClinica = `Clínica Admin ${sello}`;

  test("configuración: cuenta, organización y clínica", async ({ page }) => {
    await page.goto("/registro");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Ada");
    await page.getByLabel("Apellidos").fill("Admin");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Ada");
    await page.getByLabel("Apellidos").fill("Admin");
    await page.getByLabel("Nombre para mostrar").fill("Ada Admin");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre comercial").fill(`Vet Admin ${sello}`);
    await page.getByRole("button", { name: "Crear organización" }).click();
    await page.getByLabel("Nombre de la clínica").fill(nombreClinica);
    await page.getByRole("button", { name: /Crear clínica/ }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);
  });

  test("sin superadmin: la sección responde 404 y el nav la oculta", async ({ page }) => {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByLabel(/^Contraseña/).fill(contrasena);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // El nav NO muestra «Administración» para un usuario sin el flag.
    await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);

    // La ruta usa notFound() → 404 aunque haya sesión (defensa en profundidad).
    const respuesta = await page.request.get("/app/admin", { maxRedirects: 0 });
    expect(respuesta.status()).toBe(404);
  });

  test("con superadmin: ve Panorama, clínicas y el nav de administración", async ({ page }) => {
    // Elevar el flag con la service role LOCAL (no hay UI de superadmin todavía).
    const uid = await obtenerUid(correo);
    await api(`/rest/v1/profiles?id=eq.${uid}`, {
      method: "PATCH",
      body: JSON.stringify({ is_superadmin: true }),
    });

    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByLabel(/^Contraseña/).fill(contrasena);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // Ahora el nav sí muestra la entrada de administración.
    await expect(page.getByRole("link", { name: "Administración" })).toBeVisible();

    // Panorama de la plataforma.
    await page.goto("/app/admin");
    await expect(page.getByRole("heading", { name: "Panorama de la plataforma" })).toBeVisible();

    // Listado de clínicas: incluye al menos la clínica recién creada.
    await page.goto("/app/admin/clinicas");
    await expect(page.getByRole("heading", { name: "Clínicas de la plataforma" })).toBeVisible();
    await expect(page.getByText(nombreClinica)).toBeVisible();
  });
});
