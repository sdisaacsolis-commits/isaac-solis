import { expect, test } from "@playwright/test";

/**
 * Flujo completo de la Fase 7 contra Supabase REAL (local): recetas
 * (borrador → emisión → impresión → sustitución) y vacunación (aplicación por
 * veterinario, histórico aportado por administración, cartilla).
 * Requiere E2E_AUTH=1 y la SERVICE_ROLE del Supabase LOCAL (solo CI/local,
 * CLAUDE.md §2; jamás en la app). Prescribir y aplicar vacunas exige rol
 * veterinario (RPCs + RLS); los históricos los captura también administración.
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

/** Crea (con la service role LOCAL) un veterinario activo CON cédula profesional. */
async function crearVeterinarioFixture(nombreClinica: string, correoVet: string) {
  const usuario = (await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: correoVet,
      password: "patitas2026",
      email_confirm: true,
      user_metadata: { display_name: "Dra. E2E Receta" },
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
      // La cédula aparece en el snapshot congelado de la receta impresa.
      professional_license: "CED-1234567",
      joined_at: new Date().toISOString(),
    }),
  });
}

test.describe("Recetas y vacunación (Supabase local)", () => {
  test.skip(!habilitado, "Requiere Supabase local, E2E_AUTH=1 y SUPABASE_SERVICE_ROLE_KEY local");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  const sello = Date.now();
  const correoAdmin = `e2e.fase7.${sello}@ejemplo.mx`;
  const correoVet = `e2e.fase7.vet.${sello}@ejemplo.mx`;
  const contrasena = "patitas2026";
  const nombreClinica = `Clínica Fase7 ${sello}`;
  const anioFuturo = new Date().getFullYear() + 1;
  let folioOriginal = "";

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

  test("configuración: cuenta, veterinario con cédula, servicio, horario y paciente", async ({
    page,
  }) => {
    // Cuenta administradora + organización + clínica.
    await page.goto("/registro");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Fabiola");
    await page.getByLabel("Apellidos").fill("Fase Siete");
    await page.getByLabel("Correo electrónico").fill(correoAdmin);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Fabiola");
    await page.getByLabel("Apellidos").fill("Fase Siete");
    await page.getByLabel("Nombre para mostrar").fill("Fabiola Fase Siete");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre comercial").fill(`Vet Fase7 ${sello}`);
    await page.getByRole("button", { name: "Crear organización" }).click();
    await page.getByLabel("Nombre de la clínica").fill(nombreClinica);
    await page.getByRole("button", { name: /Crear clínica/ }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // Fixture de veterinario con cédula (solo CI/local, service role LOCAL).
    await crearVeterinarioFixture(nombreClinica, correoVet);

    // Servicio del catálogo con el veterinario asignado.
    await page.goto("/app/configuracion/servicios/nuevo");
    await page.getByLabel("Nombre del servicio").fill("Consulta Fase7 E2E");
    await page.getByLabel("Duración (minutos)").fill("30");
    await page.getByLabel("Precio (MXN)").fill("450");
    await page.getByLabel("Dra. E2E Receta").check();
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    await expect(page).toHaveURL(/\/app\/configuracion\/servicios$/);

    // Horario amplio todos los días.
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
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Rocío");
    await page.getByLabel("Apellidos").fill("Receta");
    await page.getByRole("button", { name: "Registrar propietario" }).click();
    await expect(page).toHaveURL(/\/app\/propietarios\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: "Registrar mascota" }).click();
    await page.getByLabel("Nombre de la mascota").fill("Canela");
    await page.getByRole("button", { name: "Registrar mascota" }).click();
    await expect(page).toHaveURL(/\/app\/mascotas\/[0-9a-f-]{36}/);
  });

  test("receta: consulta finalizada → borrador → emisión → impresión → sustitución", async ({
    page,
  }) => {
    // Prescribir exige rol veterinario (RPC create_prescription_draft).
    await iniciarSesion(page, correoVet);

    // Consulta walk-in con el contenido mínimo para finalizar (flujo Fase 6).
    await page.goto("/app/consultas/nueva");
    await page.getByLabel("Mascota (paciente)").selectOption({ index: 1 });
    await page.getByRole("combobox", { name: "Servicio", exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Veterinario que atiende").selectOption({ index: 1 });
    await page.getByLabel("Motivo de la consulta").fill("Dermatitis en el lomo");
    await page.getByRole("button", { name: "Abrir consulta" }).click();
    await expect(page).toHaveURL(/\/app\/consultas\/[0-9a-f-]{36}/);

    await page.getByLabel("Peso (kg)").fill("9.8");
    await page.getByRole("button", { name: "Registrar medición" }).click();
    await expect(page.getByText("La medición de signos vitales quedó registrada.")).toBeVisible();

    await page.getByLabel("Estado general").fill("Alerta, dermatitis localizada");
    await page.getByRole("button", { name: "Guardar exploración" }).click();
    await expect(page.getByText("La exploración física quedó guardada.")).toBeVisible();

    await page.getByLabel("A — Evaluación").fill("Dermatitis alérgica.");
    await page.getByLabel("P — Plan").fill("Tratamiento tópico y antibiótico oral.");
    await page.getByRole("button", { name: "Guardar nota" }).click();
    await expect(page.getByText("La nota clínica quedó guardada.")).toBeVisible();

    page.once("dialog", (dialogo) => void dialogo.accept());
    await page.getByRole("button", { name: "Finalizar consulta" }).click();
    await expect(page.getByText("Finalizada").first()).toBeVisible();

    // Crear receta desde la consulta finalizada (preselecciona la consulta).
    await page.getByRole("link", { name: "Crear receta" }).click();
    await expect(page).toHaveURL(/\/app\/recetas\/nueva\?consulta=/);
    await page.getByRole("button", { name: "Crear borrador de receta" }).click();
    await expect(page).toHaveURL(/\/app\/recetas\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Borrador de receta")).toBeVisible();

    // Dos medicamentos: el contenido clínico es texto del veterinario. El
    // formulario de alta es el que tiene el botón «Agregar medicamento» (las
    // partidas existentes llevan su propio formulario de edición plegado).
    const formularioAlta = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Agregar medicamento" }) });
    await formularioAlta
      .getByRole("textbox", { name: "Medicamento", exact: true })
      .fill("Amoxicilina 250 mg");
    await formularioAlta.getByRole("textbox", { name: "Dosis", exact: true }).fill("12.5 mg/kg");
    await formularioAlta
      .getByRole("textbox", { name: "Vía de administración", exact: true })
      .fill("Oral");
    await formularioAlta
      .getByRole("textbox", { name: "Frecuencia", exact: true })
      .fill("Cada 12 horas");
    await formularioAlta.getByRole("textbox", { name: "Duración", exact: true }).fill("10 días");
    await formularioAlta.getByRole("button", { name: "Agregar medicamento" }).click();
    await expect(page.getByText("El medicamento quedó agregado a la receta.")).toBeVisible();

    await formularioAlta
      .getByRole("textbox", { name: "Medicamento", exact: true })
      .fill("Champú clorhexidina 2%");
    await formularioAlta.getByRole("textbox", { name: "Dosis", exact: true }).fill("Baño medicado");
    await formularioAlta
      .getByRole("textbox", { name: "Vía de administración", exact: true })
      .fill("Tópica");
    await formularioAlta
      .getByRole("textbox", { name: "Frecuencia", exact: true })
      .fill("Cada 3 días");
    await formularioAlta.getByRole("textbox", { name: "Duración", exact: true }).fill("3 semanas");
    await formularioAlta.getByRole("button", { name: "Agregar medicamento" }).click();
    await expect(page.getByText("Champú clorhexidina 2%").first()).toBeVisible();

    // Instrucciones generales del encabezado (con versión optimista).
    await page
      .getByLabel("Instrucciones generales")
      .fill("Mantener la zona limpia y seca; regresar si hay supuración.");
    await page.getByRole("button", { name: "Guardar encabezado" }).click();
    await expect(page.getByText("El encabezado de la receta quedó guardado.")).toBeVisible();

    // Emisión con confirmación explícita → folio y edición bloqueada.
    page.once("dialog", (dialogo) => void dialogo.accept());
    await page.getByRole("button", { name: "Emitir receta" }).click();
    await expect(page.getByText(/REC-\d{4}-\d{6}/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar medicamento" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Guardar encabezado" })).toHaveCount(0);

    const encabezado = await page.getByRole("heading", { level: 1 }).textContent();
    folioOriginal = encabezado?.match(/REC-\d{4}-\d{6}/)?.[0] ?? "";
    expect(folioOriginal).not.toBe("");

    // Documento imprimible desde el snapshot congelado: folio + hash sha256.
    await page.getByRole("link", { name: "Ver receta imprimible" }).click();
    await expect(page).toHaveURL(/\/imprimir$/);
    await expect(page.getByText(folioOriginal).first()).toBeVisible();
    await expect(page.getByText(/sha256/).first()).toBeVisible();
    await page.getByRole("link", { name: /← Receta/ }).click();
    await expect(page).toHaveURL(/\/app\/recetas\/[0-9a-f-]{36}$/);

    // Sustitución con motivo → nuevo borrador con las partidas copiadas.
    await page.getByLabel("Motivo de la sustitución").fill("Ajuste de duración del antibiótico");
    page.once("dialog", (dialogo) => void dialogo.accept());
    await page.getByRole("button", { name: "Sustituir receta" }).click();
    await expect(page.getByText("Borrador de receta")).toBeVisible();
    await expect(page.getByText("Amoxicilina 250 mg").first()).toBeVisible();
    await expect(page.getByText("Champú clorhexidina 2%").first()).toBeVisible();
    await expect(page.getByText(folioOriginal).first()).toBeVisible(); // «Sustituye a»

    // Emitir la sustituta y volver al original: queda marcado como Sustituida.
    page.once("dialog", (dialogo) => void dialogo.accept());
    await page.getByRole("button", { name: "Emitir receta" }).click();
    await expect(page.getByText(/REC-\d{4}-\d{6}/).first()).toBeVisible();
    await page.getByRole("link", { name: folioOriginal }).click();
    await expect(page).toHaveURL(/\/app\/recetas\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Sustituida").first()).toBeVisible();
  });

  test("vacunación: aplicación por veterinario → comprobante → cartilla", async ({ page }) => {
    await iniciarSesion(page, correoVet);

    await page.goto("/app/vacunacion/nueva");
    const seccionAplicada = page.getByRole("region", { name: "Aplicada en esta clínica" });
    await seccionAplicada
      .getByRole("textbox", { name: "Nombre de la vacuna", exact: true })
      .fill("Rabivax E2E");
    await seccionAplicada.getByLabel("Fabricante").fill("Laboratorios Patitas");
    await seccionAplicada.getByRole("textbox", { name: "Lote", exact: true }).fill("L-4521");
    await seccionAplicada.getByLabel("Caducidad del lote").fill(`${anioFuturo}-06-15`);
    await seccionAplicada.getByLabel("Vía de administración").fill("Subcutánea");
    await seccionAplicada.getByLabel("Próxima dosis").fill(`${anioFuturo}-01-15`);
    await seccionAplicada.getByRole("button", { name: "Registrar aplicación" }).click();

    // Detalle del registro con fuente verificada y comprobante congelado.
    await expect(page).toHaveURL(/\/app\/vacunacion\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Rabivax E2E").first()).toBeVisible();
    await expect(page.getByText("Aplicada en esta clínica").first()).toBeVisible();
    await expect(page.getByText(/sha256/).first()).toBeVisible();

    // Comprobante imprimible.
    await page.getByRole("link", { name: "Ver comprobante imprimible" }).first().click();
    await expect(page).toHaveURL(/\/imprimir$/);
    await expect(page.getByText("Comprobante de vacunación").first()).toBeVisible();
    await expect(page.getByText(/sha256/).first()).toBeVisible();

    // Cartilla de la mascota con la vacuna y su Badge de fuente.
    await page.goto("/app/mascotas");
    await page.getByRole("link", { name: "Canela" }).click();
    await page.getByRole("link", { name: "Ver cartilla de vacunación" }).click();
    await expect(page).toHaveURL(/\/vacunacion/);
    const fila = page.getByRole("row", { name: /Rabivax E2E/ });
    await expect(fila.getByText("Aplicada en esta clínica")).toBeVisible();
    await expect(fila.getByText("Registrada")).toBeVisible();
  });

  test("vacunación histórica: la administración captura antecedentes, no aplicaciones", async ({
    page,
  }) => {
    // El admin del E2E es clinic_admin, NO veterinario: la RPC y la UI le
    // niegan la aplicación en clínica, pero sí registra históricos aportados.
    await iniciarSesion(page, correoAdmin);

    await page.goto("/app/vacunacion/nueva");
    const seccionAplicada = page.getByRole("region", { name: "Aplicada en esta clínica" });
    await expect(
      seccionAplicada.getByText(
        "Solo un veterinario activo de la clínica puede registrar una aplicación de vacuna.",
      ),
    ).toBeVisible();
    await expect(seccionAplicada.getByRole("button", { name: "Registrar aplicación" })).toHaveCount(
      0,
    );

    const seccionHistorica = page.getByRole("region", { name: "Registro histórico aportado" });
    await seccionHistorica
      .getByRole("textbox", { name: "Nombre de la vacuna", exact: true })
      .fill("Séxtuple histórica E2E");
    await seccionHistorica.getByLabel("Fecha de aplicación (pasada)").fill("2024-05-10");
    await seccionHistorica.getByLabel("Proveedor o clínica externa").fill("Clínica Externa MX");
    // Sin rol veterinario NO existe el campo de próxima dosis (decisión clínica).
    await expect(seccionHistorica.getByLabel("Próxima dosis")).toHaveCount(0);
    await seccionHistorica.getByRole("button", { name: "Registrar histórico" }).click();

    await expect(page).toHaveURL(/\/app\/vacunacion\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Séxtuple histórica E2E").first()).toBeVisible();
    await expect(page.getByText("Registro histórico aportado").first()).toBeVisible();

    // La cartilla distingue el antecedente aportado del resto.
    await page.goto("/app/mascotas");
    await page.getByRole("link", { name: "Canela" }).click();
    await page.getByRole("link", { name: "Ver cartilla de vacunación" }).click();
    const fila = page.getByRole("row", { name: /Séxtuple histórica E2E/ });
    await expect(fila.getByText("Registro histórico aportado")).toBeVisible();
  });
});
