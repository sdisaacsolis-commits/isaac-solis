import { expect, test } from "@playwright/test";

/**
 * Fase 8 — flujo completo del portal público contra Supabase REAL (local):
 * clínica pública con reservación en línea → reserva de INVITADO sin cuenta →
 * confirmación por el personal → invitación del propietario al portal →
 * cuenta del propietario → /mi (mascotas, citas) → cancelación en línea.
 * Requiere E2E_AUTH=1 y la SERVICE_ROLE del Supabase LOCAL (solo CI/local,
 * CLAUDE.md §2; jamás en la app): los ajustes de visibilidad pública del
 * fixture se hacen igual que crearVeterinarioFixture (inserts/updates REST).
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
async function crearVeterinarioFixture(
  nombreClinica: string,
  correoVet: string,
): Promise<{ userId: string }> {
  const usuario = (await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: correoVet,
      password: "patitas2026",
      email_confirm: true,
      user_metadata: { display_name: "Dra. Portal Vet" },
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
  return { userId: usuario.id };
}

/** Publica la clínica (slug + is_public + reservación en línea) vía REST local. */
async function publicarClinicaFixture(nombreClinica: string, slug: string): Promise<void> {
  await api(`/rest/v1/clinics?name=eq.${encodeURIComponent(nombreClinica)}`, {
    method: "PATCH",
    body: JSON.stringify({
      slug,
      city: "Ciudad de México",
      state: "CDMX",
      is_public: true,
      accepts_online_booking: true,
    }),
  });
}

test.describe("Portal público y portal del propietario (Supabase local)", () => {
  test.skip(!habilitado, "Requiere Supabase local, E2E_AUTH=1 y SUPABASE_SERVICE_ROLE_KEY local");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  const sello = Date.now();
  const correoAdmin = `e2e.portal.${sello}@ejemplo.mx`;
  const correoVet = `e2e.portal.vet.${sello}@ejemplo.mx`;
  const correoInvitado = `e2e.portal.invitado.${sello}@ejemplo.mx`;
  const correoPropietario = `e2e.portal.dueno.${sello}@ejemplo.mx`;
  const contrasena = "patitas2026";
  const nombreClinica = `Clínica Portal ${sello}`;
  const slugClinica = `clinica-portal-${sello}`;
  const slugVet = `dra-portal-${sello}`;
  const fechaCita = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

  test("configuración: clínica pública, veterinario con perfil, servicio, horario y paciente", async ({
    page,
  }) => {
    // Cuenta administradora + organización + clínica.
    await page.goto("/registro");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Patricia");
    await page.getByLabel("Apellidos").fill("Portal");
    await page.getByLabel("Correo electrónico").fill(correoAdmin);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Patricia");
    await page.getByLabel("Apellidos").fill("Portal");
    await page.getByLabel("Nombre para mostrar").fill("Patricia Portal");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre comercial").fill(`Vet Portal ${sello}`);
    await page.getByRole("button", { name: "Crear organización" }).click();
    await page.getByLabel("Nombre de la clínica").fill(nombreClinica);
    await page.getByRole("button", { name: /Crear clínica/ }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // Fixtures con la service role LOCAL: veterinario activo + clínica pública
    // con reservación en línea + perfil público del veterinario.
    const { userId } = await crearVeterinarioFixture(nombreClinica, correoVet);
    await publicarClinicaFixture(nombreClinica, slugClinica);
    await api("/rest/v1/veterinarian_public_profiles", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        slug: slugVet,
        headline: "Medicina interna de perros y gatos",
        is_public: true,
      }),
    });

    // Servicio del catálogo con el veterinario asignado.
    await page.goto("/app/configuracion/servicios/nuevo");
    await page.getByLabel("Nombre del servicio").fill("Consulta general E2E");
    await page.getByLabel("Duración (minutos)").fill("30");
    await page.getByLabel("Precio (MXN)").fill("450");
    await page.getByLabel("Dra. Portal Vet").check();
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

    // Propietario CON correo (requisito de la invitación al portal) + mascota.
    await page.goto("/app/propietarios/nuevo");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Paula");
    await page.getByLabel("Apellidos").fill("Propietaria");
    await page.getByLabel("Correo electrónico").fill(correoPropietario);
    await page.getByRole("button", { name: "Registrar propietario" }).click();
    await expect(page).toHaveURL(/\/app\/propietarios\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: "Registrar mascota" }).click();
    await page.getByLabel("Nombre de la mascota").fill("Canela");
    await page.getByRole("button", { name: "Registrar mascota" }).click();
    await expect(page).toHaveURL(/\/app\/mascotas\/[0-9a-f-]{36}/);

    // Cita de Paula agendada por el personal a +3 días (source staff →
    // confirmada): es la cita que la propietaria cancelará desde /mi.
    await page.goto("/app/agenda/nueva");
    await page.getByLabel("Mascota (paciente)").selectOption({ index: 1 });
    await page.getByLabel("Servicio").selectOption({ index: 1 });
    await page.getByLabel("Veterinario").selectOption({ index: 1 });
    await page.getByLabel("Fecha").fill(fechaCita);
    await page.getByRole("button", { name: "Ver disponibilidad" }).click();
    const primerSlot = page.locator('input[name="start"][type="radio"]').first();
    await expect(primerSlot).toBeVisible();
    await primerSlot.check();
    await page.getByRole("button", { name: "Agendar cita" }).click();
    await expect(page).toHaveURL(/\/app\/agenda\/[0-9a-f-]{36}/);
    await expect(page.getByText("Confirmada").first()).toBeVisible();
  });

  test("invitado sin cuenta reserva en la página pública y el personal confirma", async ({
    page,
  }) => {
    // SIN sesión: perfil público de la clínica con widget de reservación.
    await page.goto(`/clinicas/${slugClinica}`);
    await expect(page.getByRole("heading", { name: nombreClinica })).toBeVisible();
    await expect(page.getByText("Reservación en línea").first()).toBeVisible();

    // Selección de servicio → veterinario → fecha (hoy + 3 días).
    await page.getByLabel("Servicio", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Veterinario", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Fecha", { exact: true }).fill(fechaCita);
    await page.getByRole("button", { name: "Ver horarios" }).click();

    // Huecos reales: se elige el primero y se captura al invitado.
    await expect(page.getByText("Horarios disponibles")).toBeVisible();
    await page.locator('input[name="start"]').first().check();
    await page.getByRole("textbox", { name: "Nombre(s)", exact: true }).fill("Gustavo");
    await page.getByRole("textbox", { name: "Apellidos", exact: true }).fill("Invitado");
    await page
      .getByRole("textbox", { name: "Correo electrónico", exact: true })
      .fill(correoInvitado);
    await page.getByRole("textbox", { name: "Nombre de tu mascota", exact: true }).fill("Rocko");
    await page.getByLabel("Especie", { exact: true }).selectOption("dog");
    await page.getByRole("button", { name: "Solicitar cita" }).click();

    // Confirmación con folio y aviso de solicitud pendiente.
    await expect(page.getByText(/CIT-\d{4}-\d{6}/)).toBeVisible();
    await expect(page.getByText(/pendiente de confirmación/)).toBeVisible();

    // El personal ve la solicitud destacada en la agenda y la confirma.
    await iniciarSesion(page, correoAdmin);
    await page.goto("/app/agenda");
    await expect(page.getByText("Solicitudes en línea", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/CIT-\d{4}-\d{6}/).first()).toBeVisible();
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText("El estado de la cita quedó actualizado.")).toBeVisible();
  });

  test("propietaria invitada al portal ve sus mascotas y citas, y cancela en línea", async ({
    page,
  }) => {
    // El personal genera la invitación y captura el enlace (se muestra UNA vez).
    await iniciarSesion(page, correoAdmin);
    await page.goto("/app/propietarios");
    await page.getByRole("link", { name: /Paula/ }).click();
    await expect(page).toHaveURL(/\/app\/propietarios\/[0-9a-f-]{36}/);
    await page.getByRole("button", { name: "Invitar al portal" }).click();
    const campoEnlace = page.getByLabel("Enlace de invitación");
    await expect(campoEnlace).toBeVisible();
    const enlace = await campoEnlace.inputValue();
    const rutaInvitacion = new URL(enlace).pathname;
    expect(rutaInvitacion).toMatch(/^\/portal\/invitacion\/[0-9a-f]{64}$/);

    // Cierra sesión del personal y crea la cuenta de la propietaria con el
    // MISMO correo, conservando el retorno a la invitación (returnTo).
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(`/registro?next=${encodeURIComponent(rutaInvitacion)}`);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Paula");
    await page.getByLabel("Apellidos").fill("Propietaria");
    await page.getByLabel("Correo electrónico").fill(correoPropietario);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    // Con sesión, la página de invitación ofrece aceptar explícitamente.
    await expect(page).toHaveURL(new RegExp(rutaInvitacion.replaceAll("/", "\\/")));
    await page.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(page).toHaveURL(/\/mi\/mascotas/);
    await expect(page.getByText("Tu cuenta quedó vinculada", { exact: false })).toBeVisible();

    // Mis mascotas: la mascota registrada por la clínica.
    await expect(page.getByText("Canela")).toBeVisible();

    // Mis citas: la cita confirmada (a +3 días) se puede cancelar en línea
    // porque está fuera de la ventana de 2 horas.
    await page.goto("/mi/citas");
    await expect(page.getByText(/CIT-\d{4}-\d{6}/).first()).toBeVisible();
    await expect(page.getByText("Confirmada").first()).toBeVisible();
    page.once("dialog", (dialogo) => void dialogo.accept());
    await page.getByRole("button", { name: "Cancelar cita" }).first().click();
    await expect(
      page.getByText("Tu cita quedó cancelada; la clínica recibió el aviso."),
    ).toBeVisible();
    await expect(page.getByText("Cancelada").first()).toBeVisible();
  });
});
