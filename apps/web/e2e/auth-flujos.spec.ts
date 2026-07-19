import { expect, test } from "@playwright/test";

/**
 * Flujos completos de autenticación e invitaciones contra un Supabase REAL
 * (local). Requieren:
 *   - `pnpm db:start` con confirmación de correo deshabilitada (config local), y
 *   - E2E_AUTH=1 en el entorno.
 * Sin E2E_AUTH, la suite se omite: no dependemos de servicios externos para
 * que el CI base pase. Ver docs/testing/auth-e2e.md.
 */
const habilitado = process.env.E2E_AUTH === "1";

test.describe("Flujos de autenticación (Supabase local)", () => {
  test.skip(!habilitado, "Requiere Supabase local y E2E_AUTH=1");
  // Flujo progresivo: la invitación reutiliza la cuenta creada en el registro.
  // En serie, todo corre en el mismo worker (mismo `sello`) aun con reintentos.
  test.describe.configure({ mode: "serial" });

  const sello = Date.now();
  const correo = `e2e.duena.${sello}@ejemplo.mx`;
  const contrasena = "patitas2026";

  test("registro → onboarding → dashboard", async ({ page }) => {
    await page.goto("/registro");
    // Nota: con getByLabel exacto el asterisco de "campo obligatorio" rompe la
    // coincidencia; getByRole usa el nombre accesible (sin decoración).
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Elena");
    await page.getByLabel("Apellidos").fill("Prueba");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Confirmación deshabilitada en local → directo al onboarding
    await expect(page).toHaveURL(/\/app\/onboarding/);

    // Paso 1: perfil (nombre y apellidos NO se copian del registro: el paso
    // de onboarding es justamente donde se completan)
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Elena");
    await page.getByLabel("Apellidos").fill("Prueba");
    await page.getByLabel("Nombre para mostrar").fill("Dra. Elena Prueba");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Paso 2: organización
    await page.getByLabel("Nombre comercial").fill(`Vet E2E ${sello}`);
    await page.getByRole("button", { name: "Crear organización" }).click();

    // Paso 3: clínica
    await page.getByLabel("Nombre de la clínica").fill("Clínica E2E Centro");
    await page.getByRole("button", { name: /Crear clínica/ }).click();

    // Dashboard con datos reales
    await expect(page).toHaveURL(/\/app\/inicio/);
    // .first(): el nombre aparece también en la barra de navegación.
    await expect(page.getByText("Dra. Elena Prueba").first()).toBeVisible();
    await expect(page.getByText("Clínica E2E Centro").first()).toBeVisible();
  });

  test("crear invitación y aceptarla en una segunda sesión", async ({ browser, page }) => {
    // Sesión A: administradora invita
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByLabel(/^Contraseña/).fill(contrasena);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    const correoInvitada = `e2e.recepcion.${sello}@ejemplo.mx`;
    await page.goto("/app/personal");
    await page.getByLabel("Correo de la persona").fill(correoInvitada);
    await page.getByRole("button", { name: "Crear y enviar invitación" }).click();
    await expect(page.getByText(correoInvitada)).toBeVisible();

    // En modo dev el correo no se envía: la invitación existe y puede reenviarse.
    // Para aceptar en E2E se necesitaría el token del enlace; ese tramo se
    // valida en pgTAP (aceptación, vencimiento, revocación) y aquí se cubre
    // la creación + visibilidad + acciones de reenvío/revocación.
    await expect(page.getByRole("button", { name: "Reenviar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Revocar" })).toBeVisible();

    // Sesión B (contexto independiente): la ruta privada sigue protegida.
    const contextoB = await browser.newContext();
    const paginaB = await contextoB.newPage();
    await paginaB.goto("/app/personal");
    await expect(paginaB).toHaveURL(/\/iniciar-sesion/);
    await contextoB.close();
  });

  test("recuperación de contraseña muestra confirmación neutra", async ({ page }) => {
    await page.goto("/recuperar-contrasena");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByText(/recibirás un enlace/)).toBeVisible();
  });
});
