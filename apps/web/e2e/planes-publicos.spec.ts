import { expect, test } from "@playwright/test";

test.describe("Planes públicos de Dogtoralia", () => {
  test("publica precios de referencia sin habilitar compra ni cobros", async ({ page }) => {
    const response = await page.goto("/planes");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Planes para clínicas veterinarias/);
    await expect(page.getByRole("heading", { name: "30 días gratis" })).toBeVisible();
    await expect(page.getByText(/Sin tarjeta ni cobro automático/)).toBeVisible();

    for (const [name, price, locations, vets] of [
      ["Consultorio", "$349", "1 sede", "Hasta 2 veterinarios en total"],
      ["Clínica", "$649", "1 sede", "Hasta 6 veterinarios en total"],
      ["Red", "$1,099", "Hasta 3 sedes", "Hasta 12 veterinarios en total"],
    ] as const) {
      const card = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("heading", { name, exact: true }) })
        .first();
      await expect(card).toContainText(price);
      await expect(card).toContainText(locations);
      await expect(card).toContainText(vets);
      await expect(card).toContainText("IVA incluido");
      await expect(card).toContainText("Próximamente para contratar");
      await expect(card.getByRole("link")).toHaveCount(0);
      await expect(card.getByRole("button")).toHaveCount(0);
    }

    await page.getByText("¿Me van a cobrar al terminar la prueba?").click();
    await expect(page.getByText(/no se convierte en una suscripción de pago/)).toBeVisible();
    await page.getByText("¿Me van a cobrar al terminar la prueba?").click();
    await expect(page.getByText(/no se convierte en una suscripción de pago/)).toBeHidden();
  });

  test("mantiene los accesos a registro, invitaciones y búsqueda de citas", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 });
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute(
      "href",
      "/registro",
    );
    await header.getByRole("link", { name: "Planes para clínicas" }).click();
    await expect(page).toHaveURL(/\/planes$/);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(320);

    await page.getByRole("link", { name: "Empezar mi prueba" }).first().click();
    await expect(page).toHaveURL(/\/registro\?plan=prueba$/);
    await expect(
      page.getByText(/configura una clínica nueva para iniciar 30 días gratis/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Busca una clínica sin crear cuenta" }),
    ).toHaveAttribute("href", "/buscar");

    await page.goBack();
    await expect(page).toHaveURL(/\/planes$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/registro\?plan=prueba$/);
    await page.getByRole("link", { name: "Volver a planes para clínicas" }).click();
    await expect(page).toHaveURL(/\/planes$/);

    const invitation = "/portal/invitacion/" + "a".repeat(64);
    await page.goto(`/registro?plan=prueba&next=${encodeURIComponent(invitation)}`);
    await expect(
      page.getByText("Usa el correo al que llegó la invitación para continuar."),
    ).toBeVisible();
    await expect(page.getByText(/configura una clínica nueva para iniciar/)).toHaveCount(0);
    await expect(page.locator('input[name="next"]')).toHaveValue(invitation);
  });
});
