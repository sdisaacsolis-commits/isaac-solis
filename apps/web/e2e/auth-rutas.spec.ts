import { expect, test } from "@playwright/test";

/**
 * Estas pruebas NO requieren Supabase: verifican protección de rutas,
 * renderizado de formularios y manejo de enlaces de invitación inválidos.
 */
test.describe("Protección de rutas y páginas de autenticación", () => {
  test("una ruta privada sin sesión redirige a iniciar sesión", async ({ page }) => {
    await page.goto("/app/inicio");
    await expect(page).toHaveURL(/\/iniciar-sesion/);
  });

  test("todas las rutas privadas están protegidas", async ({ page }) => {
    for (const ruta of [
      "/app",
      "/app/personal",
      "/app/organizacion",
      "/app/configuracion",
      "/app/propietarios",
      "/app/mascotas",
      "/app/mascotas/nueva",
      "/app/agenda",
      "/app/agenda/nueva",
      "/app/consultas",
      "/app/consultas/nueva",
      "/app/recetas",
      "/app/recetas/nueva",
      "/app/vacunacion",
      "/app/vacunacion/nueva",
      "/app/configuracion/servicios",
      "/app/configuracion/horarios",
      "/app/configuracion/vacunas",
    ]) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/iniciar-sesion/);
    }
  });

  test("la página de inicio de sesión muestra el formulario", async ({ page }) => {
    await page.goto("/iniciar-sesion");
    await expect(page.getByLabel(/Correo electrónico/)).toBeVisible();
    await expect(page.getByLabel(/^Contraseña/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("la página de registro muestra el formulario completo", async ({ page }) => {
    await page.goto("/registro");
    await expect(page.getByLabel(/Nombre/).first()).toBeVisible();
    await expect(page.getByLabel(/Apellidos/)).toBeVisible();
    await expect(page.getByLabel(/Correo electrónico/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeVisible();
  });

  test("la recuperación de contraseña está disponible", async ({ page }) => {
    await page.goto("/recuperar-contrasena");
    await expect(page.getByRole("button", { name: "Enviar enlace" })).toBeVisible();
  });

  test("un enlace de invitación malformado muestra error claro", async ({ page }) => {
    await page.goto("/invitaciones/token-invalido");
    await expect(page.getByText("El enlace de invitación no es válido.")).toBeVisible();
  });

  test("un enlace de invitación válido sin sesión ofrece iniciar sesión o registrarse", async ({
    page,
  }) => {
    const token = "a".repeat(64);
    await page.goto(`/invitaciones/${token}`);
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear cuenta" })).toBeVisible();
    // El destino de retorno conserva el token para continuar tras autenticarse
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
      "href",
      new RegExp(encodeURIComponent(`/invitaciones/${token}`)),
    );
  });
});
