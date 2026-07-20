import { expect, test } from "@playwright/test";

/**
 * Flujo completo de agenda contra Supabase REAL (local): catálogo → horario →
 * disponibilidad → cita → transiciones → cancelación. Requiere E2E_AUTH=1 y,
 * para crear el fixture de veterinario (no hay UI de cambio de rol todavía),
 * la SERVICE_ROLE del Supabase LOCAL en SUPABASE_SERVICE_ROLE_KEY. Esa llave
 * solo existe en CI/local (CLAUDE.md §2 la permite en CI); jamás en la app.
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

/** Crea (con la service role LOCAL) un veterinario activo en la clínica. */
async function crearVeterinarioFixture(nombreClinica: string, correoVet: string) {
  const usuario = (await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: correoVet,
      password: "patitas2026",
      email_confirm: true,
      user_metadata: { display_name: "Dr. E2E Vet" },
    }),
  })) as { id: string };

  const clinicas = (await api(
    `/rest/v1/clinics?name=eq.${encodeURIComponent(nombreClinica)}&select=id,organization_id`,
    { method: "GET" },
  )) as { id: string; organization_id: string }[];
  const clinica = clinicas[0];
  if (!clinica) throw new Error("clínica del E2E no encontrada");

  await api("/rest/v1/organization_members", {
    method: "POST",
    body: JSON.stringify({
      organization_id: clinica.organization_id,
      user_id: usuario.id,
      role: "member",
      status: "active",
      joined_at: new Date().toISOString(),
    }),
  });
  await api("/rest/v1/clinic_members", {
    method: "POST",
    body: JSON.stringify({
      clinic_id: clinica.id,
      user_id: usuario.id,
      role: "veterinarian",
      status: "active",
      joined_at: new Date().toISOString(),
    }),
  });
}

test.describe("Agenda de citas (Supabase local)", () => {
  test.skip(!habilitado, "Requiere Supabase local, E2E_AUTH=1 y SUPABASE_SERVICE_ROLE_KEY local");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const sello = Date.now();
  const correo = `e2e.agenda.${sello}@ejemplo.mx`;
  const contrasena = "patitas2026";
  const nombreClinica = `Clínica Agenda ${sello}`;

  test("configuración: cuenta, veterinario, servicio y horario", async ({ page }) => {
    // Cuenta administradora + organización + clínica.
    await page.goto("/registro");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Alma");
    await page.getByLabel("Apellidos").fill("Agenda");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Alma");
    await page.getByLabel("Apellidos").fill("Agenda");
    await page.getByLabel("Nombre para mostrar").fill("Alma Agenda");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre comercial").fill(`Vet Agenda ${sello}`);
    await page.getByRole("button", { name: "Crear organización" }).click();
    await page.getByLabel("Nombre de la clínica").fill(nombreClinica);
    await page.getByRole("button", { name: /Crear clínica/ }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // Fixture de veterinario (solo CI/local, con la service role LOCAL).
    await crearVeterinarioFixture(nombreClinica, `e2e.vet.${sello}@ejemplo.mx`);

    // Servicio del catálogo con el veterinario asignado.
    await page.goto("/app/configuracion/servicios/nuevo");
    await page.getByLabel("Nombre del servicio").fill("Consulta E2E");
    await page.getByLabel("Duración (minutos)").fill("30");
    await page.getByLabel("Precio (MXN)").fill("350");
    await page.getByLabel("Dr. E2E Vet").check();
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    await expect(page).toHaveURL(/\/app\/configuracion\/servicios$/);
    await expect(page.getByRole("link", { name: "Consulta E2E" })).toBeVisible();

    // Horario semanal amplio (todos los días) para que siempre haya slots.
    await page.goto("/app/configuracion/horarios");
    for (let i = 0; i < 7; i += 1) {
      await page.getByRole("button", { name: "Agregar ventana" }).click();
      const selects = page.locator('select[name="weekday"]');
      await selects.nth(i).selectOption(String(i + 1));
      await page.locator('input[name="startTime"]').nth(i).fill("00:15");
      await page.locator('input[name="endTime"]').nth(i).fill("23:45");
    }
    await page.getByRole("button", { name: "Guardar horario" }).click();
    await expect(page.getByText("El horario semanal quedó guardado.")).toBeVisible();
  });

  test("cita: disponibilidad → agendar → check-in → completar", async ({ page }) => {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByLabel(/^Contraseña/).fill(contrasena);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // Paciente: propietario + mascota.
    await page.goto("/app/propietarios/nuevo");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Olivia");
    await page.getByLabel("Apellidos").fill("Ortega");
    await page.getByRole("button", { name: "Registrar propietario" }).click();
    await expect(page).toHaveURL(/\/app\/propietarios\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: "Registrar mascota" }).click();
    await page.getByLabel("Nombre de la mascota").fill("Kira");
    await page.getByRole("button", { name: "Registrar mascota" }).click();
    await expect(page).toHaveURL(/\/app\/mascotas\/[0-9a-f-]{36}/);

    // Nueva cita para mañana: la disponibilidad debe ofrecer slots.
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.goto("/app/agenda/nueva");
    // Único paciente registrado: la primera opción real (índice 1 tras el "—").
    await page.getByLabel("Mascota (paciente)").selectOption({ index: 1 });
    await page.getByLabel("Servicio").selectOption({ index: 1 });
    await page.getByLabel("Veterinario").selectOption({ index: 1 });
    await page.getByLabel("Fecha").fill(manana);
    await page.getByRole("button", { name: "Ver disponibilidad" }).click();

    const primerSlot = page.locator('input[name="start"][type="radio"]').first();
    await expect(primerSlot).toBeVisible();
    await primerSlot.check();
    await page.getByLabel(/Motivo de la consulta/).fill("Revisión E2E");
    await page.getByRole("button", { name: "Agendar cita" }).click();

    // Detalle: folio y estado confirmado.
    await expect(page).toHaveURL(/\/app\/agenda\/[0-9a-f-]{36}/);
    await expect(page.getByText(/CIT-\d{4}-\d{6}/).first()).toBeVisible();
    await expect(page.getByText("Confirmada").first()).toBeVisible();

    // Transiciones: llegada → atención → completada (admin puede el acto clínico).
    await page.getByRole("button", { name: "Registrar llegada" }).click();
    await expect(page.getByRole("button", { name: "Iniciar atención" })).toBeVisible();
    await page.getByRole("button", { name: "Iniciar atención" }).click();
    await expect(page.getByRole("button", { name: "Completar" })).toBeVisible();
    await page.getByRole("button", { name: "Completar" }).click();
    await expect(page.getByText("Completada").first()).toBeVisible();

    // La cita aparece en la vista de día correspondiente.
    await page.goto(`/app/agenda?fecha=${manana}&vista=dia`);
    await expect(page.getByRole("link", { name: /CIT-\d{4}-\d{6}/ })).toBeVisible();
  });

  test("cancelación con motivo libera y registra", async ({ page }) => {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByLabel(/^Contraseña/).fill(contrasena);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.goto("/app/agenda/nueva");
    await page.getByLabel("Mascota (paciente)").selectOption({ index: 1 });
    await page.getByLabel("Servicio").selectOption({ index: 1 });
    await page.getByLabel("Veterinario").selectOption({ index: 1 });
    await page.getByLabel("Fecha").fill(manana);
    await page.getByRole("button", { name: "Ver disponibilidad" }).click();
    await page.locator('input[name="start"][type="radio"]').first().check();
    await page.getByRole("button", { name: "Agendar cita" }).click();
    await expect(page).toHaveURL(/\/app\/agenda\/[0-9a-f-]{36}/);

    await page.getByLabel("Motivo de la cancelación").fill("La propietaria no puede asistir");
    await page.getByRole("button", { name: "Cancelar cita" }).click();
    await expect(page.getByText("Cancelada").first()).toBeVisible();
  });
});
