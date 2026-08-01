import { expect, test } from "@playwright/test";

/**
 * Páginas legales públicas (LFPDPPP): NO requieren sesión y NO forman parte de
 * las rutas protegidas. Verifican que respondan 200, muestren su encabezado y
 * estén enlazadas desde el pie de página público.
 */
test.describe("Páginas legales públicas", () => {
  test("el aviso de privacidad responde 200 sin sesión y muestra su encabezado", async ({
    page,
  }) => {
    const respuesta = await page.goto("/aviso-de-privacidad");
    expect(respuesta?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Aviso de Privacidad Integral" }),
    ).toBeVisible();
  });

  test("los términos responden 200 sin sesión y muestran su encabezado", async ({ page }) => {
    const respuesta = await page.goto("/terminos");
    expect(respuesta?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Términos y Condiciones" }),
    ).toBeVisible();
  });

  test("las páginas legales están enlazadas desde el pie de la portada", async ({ page }) => {
    await page.goto("/");
    const aviso = page.getByRole("link", { name: "Aviso de privacidad" });
    const terminos = page.getByRole("link", { name: "Términos y condiciones" });
    await expect(aviso).toHaveAttribute("href", "/aviso-de-privacidad");
    await expect(terminos).toHaveAttribute("href", "/terminos");

    await aviso.click();
    await expect(page).toHaveURL(/\/aviso-de-privacidad$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Aviso de Privacidad Integral" }),
    ).toBeVisible();
  });
});
