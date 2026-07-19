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

    // El botón informativo existe y está deshabilitado (aún sin funcionalidad)
    const botones = page.getByRole("button", { name: "Próximamente" });
    await expect(botones.first()).toBeVisible();
    await expect(botones.first()).toBeDisabled();

    // El documento declara español de México
    await expect(page.locator("html")).toHaveAttribute("lang", "es-MX");
  });
});
