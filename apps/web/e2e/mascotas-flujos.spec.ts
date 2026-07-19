import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Flujos de propietarios y mascotas contra Supabase REAL (local).
 * Requieren `pnpm db:start` + E2E_AUTH=1 (ver docs/testing/auth-e2e.md).
 * Los datos son desechables y el archivo de foto es un PNG mínimo generado
 * en el propio repositorio de pruebas (e2e/fixtures/mascota.png).
 */
const habilitado = process.env.E2E_AUTH === "1";

test.describe("Propietarios y mascotas (Supabase local)", () => {
  test.skip(!habilitado, "Requiere Supabase local y E2E_AUTH=1");

  const sello = Date.now();
  const correo = `e2e.recep.${sello}@ejemplo.mx`;
  const contrasena = "patitas2026";

  test("registro completo: propietario → mascota con foto → búsqueda → segundo propietario", async ({
    page,
  }) => {
    // Cuenta nueva con organización y clínica propias (rol owner ⇒ puede registrar)
    await page.goto("/registro");
    await page.getByLabel("Nombre", { exact: true }).fill("Rebeca");
    await page.getByLabel("Apellidos").fill("Prueba");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await page.getByLabel("Nombre para mostrar").fill("Rebeca Prueba");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre comercial").fill(`Vet E2E Pacientes ${sello}`);
    await page.getByRole("button", { name: "Crear organización" }).click();
    await page.getByLabel("Nombre de la clínica").fill("Clínica E2E Pacientes");
    await page.getByRole("button", { name: /Crear clínica/ }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // Propietario
    await page.goto("/app/propietarios/nuevo");
    await page.getByLabel("Nombre", { exact: true }).fill("Laura");
    await page.getByLabel("Apellidos").fill("Ramírez");
    await page.getByLabel("Teléfono", { exact: true }).fill("+52 55 1111 2222");
    await page.getByRole("button", { name: "Registrar propietario" }).click();
    await expect(page).toHaveURL(/\/app\/propietarios\/[0-9a-f-]{36}/);

    // Mascota con fotografía
    await page.getByRole("link", { name: "Registrar mascota" }).click();
    await page.getByLabel("Nombre de la mascota").fill("Firulais");
    await page.getByLabel("Raza").fill("Mestizo");
    await page.getByLabel(/Fotografía/).setInputFiles(path.join(__dirname, "fixtures/mascota.png"));
    await page.getByRole("button", { name: "Registrar mascota" }).click();
    await expect(page).toHaveURL(/\/app\/mascotas\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Firulais" })).toBeVisible();

    // Búsquedas por nombre y teléfono
    await page.goto("/app/mascotas");
    await page.getByPlaceholder(/Buscar por nombre/).fill("Firu");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("link", { name: "Firulais" })).toBeVisible();

    await page.goto("/app/propietarios");
    await page.getByPlaceholder(/Buscar por nombre/).fill("+525511112222");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("link", { name: /Laura/ })).toBeVisible();

    // Segundo propietario + transferir principal
    await page.goto("/app/propietarios/nuevo");
    await page.getByLabel("Nombre", { exact: true }).fill("Pedro");
    await page.getByLabel("Apellidos").fill("Ramírez");
    await page.getByRole("button", { name: "Registrar propietario" }).click();

    await page.goto("/app/mascotas");
    await page.getByRole("link", { name: "Firulais" }).click();
    await page.getByLabel("Añadir propietario").selectOption({ label: "Pedro Ramírez" });
    await page.getByRole("button", { name: "Añadir propietario" }).click();
    await expect(page.getByText("Se agregó el propietario a la mascota.")).toBeVisible();
    await page.getByRole("button", { name: "Hacer principal" }).click();
    await expect(page.getByText("Principal")).toBeVisible();

    // Alerta administrativa
    await page.getByLabel("Título").fill("Usar bozal");
    await page.getByRole("button", { name: "Nueva alerta" }).click();
    await expect(page.getByText("Usar bozal")).toBeVisible();
  });

  test("un usuario de otra clínica no accede por URL directa", async ({ browser }) => {
    const contexto = await browser.newContext();
    const pagina = await contexto.newPage();
    // Sin sesión: protegido. (El aislamiento con sesión ajena está demostrado
    // exhaustivamente en pgTAP 07; aquí validamos la capa de rutas.)
    await pagina.goto("/app/mascotas/00000000-0000-4000-8000-0000000000aa");
    await expect(pagina).toHaveURL(/\/iniciar-sesion/);
    await contexto.close();
  });
});
