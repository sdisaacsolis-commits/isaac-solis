import { expect, test } from "@playwright/test";

/**
 * Flujo completo del expediente clínico contra Supabase REAL (local):
 * cuenta → fixture de veterinario → paciente → consulta walk-in → contenido
 * clínico → finalización → adenda → documento imprimible → expediente.
 * Requiere E2E_AUTH=1 y la SERVICE_ROLE del Supabase LOCAL (solo CI/local,
 * CLAUDE.md §2; jamás en la app). El contenido clínico exige rol veterinario
 * (RLS), por eso la captura clínica se hace con la cuenta del veterinario.
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

test.describe("Expediente clínico (Supabase local)", () => {
  test.skip(!habilitado, "Requiere Supabase local, E2E_AUTH=1 y SUPABASE_SERVICE_ROLE_KEY local");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  const sello = Date.now();
  const correoAdmin = `e2e.expediente.${sello}@ejemplo.mx`;
  const correoVet = `e2e.expediente.vet.${sello}@ejemplo.mx`;
  const contrasena = "patitas2026";
  const nombreClinica = `Clínica Expediente ${sello}`;

  async function iniciarSesion(
    page: import("@playwright/test").Page,
    correo: string,
  ): Promise<void> {
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico").fill(correo);
    await page.getByLabel(/^Contraseña/).fill(contrasena);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);
  }

  test("configuración: cuenta, veterinario, servicio, horario y paciente", async ({ page }) => {
    // Cuenta administradora + organización + clínica.
    await page.goto("/registro");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Elena");
    await page.getByLabel("Apellidos").fill("Expediente");
    await page.getByLabel("Correo electrónico").fill(correoAdmin);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Elena");
    await page.getByLabel("Apellidos").fill("Expediente");
    await page.getByLabel("Nombre para mostrar").fill("Elena Expediente");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre comercial").fill(`Vet Expediente ${sello}`);
    await page.getByRole("button", { name: "Crear organización" }).click();
    await page.getByLabel("Nombre de la clínica").fill(nombreClinica);
    await page.getByRole("button", { name: /Crear clínica/ }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // Fixture de veterinario (solo CI/local, con la service role LOCAL).
    await crearVeterinarioFixture(nombreClinica, correoVet);

    // Servicio del catálogo con el veterinario asignado.
    await page.goto("/app/configuracion/servicios/nuevo");
    await page.getByLabel("Nombre del servicio").fill("Consulta clínica E2E");
    await page.getByLabel("Duración (minutos)").fill("30");
    await page.getByLabel("Precio (MXN)").fill("400");
    await page.getByLabel("Dr. E2E Vet").check();
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    await expect(page).toHaveURL(/\/app\/configuracion\/servicios$/);

    // Horario amplio todos los días (los walk-ins no lo exigen, pero deja la
    // agenda utilizable para el resto del flujo).
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

    // Paciente: propietario + mascota.
    await page.goto("/app/propietarios/nuevo");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Paula");
    await page.getByLabel("Apellidos").fill("Paciente");
    await page.getByRole("button", { name: "Registrar propietario" }).click();
    await expect(page).toHaveURL(/\/app\/propietarios\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: "Registrar mascota" }).click();
    await page.getByLabel("Nombre de la mascota").fill("Nube");
    await page.getByRole("button", { name: "Registrar mascota" }).click();
    await expect(page).toHaveURL(/\/app\/mascotas\/[0-9a-f-]{36}/);
  });

  test("consulta walk-in: contenido clínico → finalización → adenda → impresión", async ({
    page,
  }) => {
    // El contenido clínico (nota, exploración, diagnósticos, finalizar) exige
    // rol veterinario por RLS: la captura la hace el veterinario del fixture.
    await iniciarSesion(page, correoVet);

    // Walk-in desde la pantalla de nueva consulta.
    await page.goto("/app/consultas/nueva");
    await page.getByLabel("Mascota (paciente)").selectOption({ index: 1 });
    await page.getByRole("combobox", { name: "Servicio", exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Veterinario que atiende").selectOption({ index: 1 });
    await page.getByLabel("Motivo de la consulta").fill("Cojera súbita en pata trasera");
    await page.getByRole("button", { name: "Abrir consulta" }).click();

    await expect(page).toHaveURL(/\/app\/consultas\/[0-9a-f-]{36}/);
    await expect(page.getByText(/CON-\d{4}-\d{6}/).first()).toBeVisible();
    await expect(page.getByText("En curso (borrador)").first()).toBeVisible();

    // Signos vitales.
    await page.getByLabel("Peso (kg)").fill("12.4");
    await page.getByLabel("Temperatura (°C)").fill("38.5");
    await page.getByRole("button", { name: "Registrar medición" }).click();
    await expect(page.getByText("La medición de signos vitales quedó registrada.")).toBeVisible();

    // Exploración física.
    await page.getByLabel("Estado general").fill("Alerta");
    await page.getByRole("button", { name: "Guardar exploración" }).click();
    await expect(page.getByText("La exploración física quedó guardada.")).toBeVisible();

    // Nota SOAP.
    await page.getByLabel("S — Subjetivo").fill("La propietaria reporta cojera desde ayer.");
    await page.getByLabel("O — Objetivo").fill("Dolor a la palpación en tarso derecho.");
    await page.getByLabel("A — Evaluación").fill("Esguince leve de tarso.");
    await page.getByLabel("P — Plan").fill("Reposo 7 días y antiinflamatorio.");
    await page.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText("La nota clínica quedó guardada.")).toBeVisible();

    // Diagnóstico principal.
    await page.getByRole("textbox", { name: "Diagnóstico", exact: true }).fill("Esguince de tarso");
    await page.getByLabel("Es el diagnóstico principal").check();
    await page.getByRole("button", { name: "Agregar diagnóstico" }).click();
    await expect(page.getByText("El diagnóstico quedó registrado.")).toBeVisible();

    // Tratamiento.
    await page
      .getByRole("textbox", { name: "Tratamiento", exact: true })
      .fill("Meloxicam suspensión");
    await page.getByLabel("Indicaciones").fill("0.1 mg/kg cada 24 h por 5 días");
    await page.getByRole("button", { name: "Agregar tratamiento" }).click();
    await expect(page.getByText("El tratamiento quedó registrado.")).toBeVisible();

    // Finalización (confirmación del navegador) → inmutable.
    page.once("dialog", (dialogo) => void dialogo.accept());
    await page.getByRole("button", { name: "Finalizar consulta" }).click();
    await expect(page.getByText("Finalizada").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar nota" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Finalizar consulta" })).toHaveCount(0);

    // Adenda sobre la consulta finalizada.
    await page.getByLabel("Contenido de la adenda").fill("Se aclara dosis: 0.05 mg/kg tras día 3.");
    await page.getByLabel("Motivo de la adenda").fill("Corrección de dosis");
    await page.getByRole("button", { name: "Agregar adenda" }).click();
    await expect(page.getByText("La adenda quedó registrada.")).toBeVisible();

    // Documento clínico imprimible con folio visible.
    await page.getByRole("link", { name: "Ver documento clínico" }).click();
    await expect(page).toHaveURL(/\/imprimir$/);
    await expect(page.getByText(/CON-\d{4}-\d{6}/).first()).toBeVisible();
    await expect(page.getByText("Documento clínico").first()).toBeVisible();
  });

  test("expediente de la mascota muestra la consulta", async ({ page }) => {
    await iniciarSesion(page, correoAdmin);

    await page.goto("/app/mascotas");
    await page.getByRole("link", { name: "Nube" }).click();
    await expect(page).toHaveURL(/\/app\/mascotas\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: "Ver expediente clínico" }).click();
    await expect(page).toHaveURL(/\/expediente/);
    await expect(page.getByRole("link", { name: /CON-\d{4}-\d{6}/ })).toBeVisible();
    // Se asevera dentro de la fila de la consulta: el filtro de estado también
    // contiene el texto "Finalizada" como <option> (oculto en un select cerrado).
    const fila = page.getByRole("row", { name: /CON-\d{4}-\d{6}/ });
    await expect(fila.getByText("Finalizada")).toBeVisible();
    await expect(fila.getByText("Esguince de tarso")).toBeVisible();
  });
});
