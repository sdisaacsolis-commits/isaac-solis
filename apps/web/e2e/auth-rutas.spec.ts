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
      "/app/opiniones",
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
      "/mi",
      "/mi/mascotas",
      "/mi/citas",
      "/mi/opiniones",
    ]) {
      // Se verifica el redirect del middleware por la RESPUESTA HTTP directa
      // (sin maxRedirects): es determinista y evita la carrera de navegación
      // del navegador (ERR_ABORTED) con muchos redirects secuenciales.
      const respuesta = await page.request.get(ruta, { maxRedirects: 0 });
      expect([302, 307]).toContain(respuesta.status());
      expect(respuesta.headers()["location"]).toContain("/iniciar-sesion");
    }
  });

  test("la búsqueda pública responde sin sesión con estado vacío claro", async ({ page }) => {
    const respuesta = await page.goto("/buscar?q=veterinaria-que-no-existe");
    expect(respuesta?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Clínicas veterinarias" })).toBeVisible();
    await expect(
      page.getByText("No encontramos clínicas con esos criterios", { exact: false }),
    ).toBeVisible();
  });

  test("una clínica pública inexistente responde 404 sin sesión", async ({ page }) => {
    const respuesta = await page.goto("/clinicas/slug-inexistente");
    expect(respuesta?.status()).toBe(404);
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
