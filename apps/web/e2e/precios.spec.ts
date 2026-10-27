import { expect, test } from "@playwright/test";

test.describe("Página de precios", () => {
  test("carga con el contenido esencial en español", async ({ page }) => {
    await page.goto("/precios");

    await expect(page).toHaveTitle(/Precios/);
    await expect(
      page.getByRole("heading", { name: "Un precio simple para toda tu clínica" }),
    ).toBeVisible();

    // La prueba de 14 días y las preguntas frecuentes son contenido estático
    // (el catálogo de planes llega de Supabase y puede no estar en este entorno).
    await expect(page.getByText("14 días de prueba gratis. Sin tarjeta.")).toBeVisible();
    await expect(page.getByText("¿Necesito tarjeta para probar Dogtoralia?")).toBeVisible();

    // Enlace del pie hacia precios presente en el layout público.
    await expect(page.getByRole("link", { name: "Precios" })).toBeVisible();
  });
});
