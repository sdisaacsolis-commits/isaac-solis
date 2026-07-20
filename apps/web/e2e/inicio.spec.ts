import { expect, test } from "@playwright/test";

test.describe("Página de inicio", () => {
  test("carga y muestra el contenido esencial en español", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Dogtoralia/);
    await expect(
      page.getByRole("heading", {
        name: "Gestión veterinaria, agenda y cuidado de mascotas en un solo lugar",
      }),
    ).toBeVisible();

    // Accesos a autenticación
    await expect(page.getByRole("link", { name: "Iniciar sesión" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear cuenta" }).first()).toBeVisible();

    // El documento declara español de México
    await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
  });
});
