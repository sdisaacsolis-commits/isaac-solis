import { expect, test } from "@playwright/test";

/**
 * Fase 8.1 — flujo completo de reseñas verificadas contra Supabase REAL
 * (local): clínica pública + veterinario con cédula + servicio + horario +
 * propietario con correo + mascota → cita agendada por el personal y COMPLETADA
 * → invitación del propietario al portal → el propietario deja una reseña de 5
 * estrellas en /mi/opiniones → la reseña (promedio + texto) aparece en el perfil
 * público → el personal responde desde /app/opiniones → la respuesta aparece en
 * el perfil público. Requiere E2E_AUTH=1 y la SERVICE_ROLE del Supabase LOCAL
 * (solo CI/local, CLAUDE.md §2; jamás en la app): los fixtures de visibilidad y
 * de veterinario se crean con inserts/updates REST, igual que en portal-flujos.
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

/** Crea (con la service role LOCAL) un veterinario activo con cédula. */
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
      user_metadata: { display_name: "Dra. Reseña Vet" },
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
      professional_license: "MVZ-987654",
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

test.describe("Reseñas verificadas (Supabase local)", () => {
  test.skip(!habilitado, "Requiere Supabase local, E2E_AUTH=1 y SUPABASE_SERVICE_ROLE_KEY local");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  const sello = Date.now();
  const correoAdmin = `e2e.resena.${sello}@ejemplo.mx`;
  const correoVet = `e2e.resena.vet.${sello}@ejemplo.mx`;
  const correoPropietario = `e2e.resena.dueno.${sello}@ejemplo.mx`;
  const contrasena = "patitas2026";
  const nombreClinica = `Clínica Reseña ${sello}`;
  const slugClinica = `clinica-resena-${sello}`;
  const fechaCita = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const tituloResena = `Muy buena experiencia ${sello}`;
  const cuerpoResena = `Excelente atención, la doctora fue muy amable. Ref ${sello}.`;
  const respuestaClinica = `Gracias por tu confianza, te esperamos pronto. Ref ${sello}.`;

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

  test("configuración: clínica pública, veterinario, servicio, horario, paciente y cita completada", async ({
    page,
  }) => {
    // Cuenta administradora + organización + clínica.
    await page.goto("/registro");
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Renata");
    await page.getByLabel("Apellidos").fill("Reseña");
    await page.getByLabel("Correo electrónico").fill(correoAdmin);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Renata");
    await page.getByLabel("Apellidos").fill("Reseña");
    await page.getByLabel("Nombre para mostrar").fill("Renata Reseña");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Nombre comercial").fill(`Vet Reseña ${sello}`);
    await page.getByRole("button", { name: "Crear organización" }).click();
    await page.getByLabel("Nombre de la clínica").fill(nombreClinica);
    await page.getByRole("button", { name: /Crear clínica/ }).click();
    await expect(page).toHaveURL(/\/app\/inicio/);

    // Fixtures con la service role LOCAL: veterinario con cédula + clínica pública.
    await crearVeterinarioFixture(nombreClinica, correoVet);
    await publicarClinicaFixture(nombreClinica, slugClinica);

    // Servicio del catálogo con el veterinario asignado.
    await page.goto("/app/configuracion/servicios/nuevo");
    await page.getByLabel("Nombre del servicio").fill("Consulta reseña E2E");
    await page.getByLabel("Duración (minutos)").fill("30");
    await page.getByLabel("Precio (MXN)").fill("500");
    await page.getByLabel("Dra. Reseña Vet").check();
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
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Pamela");
    await page.getByLabel("Apellidos").fill("Propietaria");
    await page.getByLabel("Correo electrónico").fill(correoPropietario);
    await page.getByRole("button", { name: "Registrar propietario" }).click();
    await expect(page).toHaveURL(/\/app\/propietarios\/[0-9a-f-]{36}/);
    await page.getByRole("link", { name: "Registrar mascota" }).click();
    await page.getByLabel("Nombre de la mascota").fill("Motita");
    await page.getByRole("button", { name: "Registrar mascota" }).click();
    await expect(page).toHaveURL(/\/app\/mascotas\/[0-9a-f-]{36}/);

    // Cita agendada por el personal (confirmada) y COMPLETADA: es la cita que
    // habilita la reseña. El acto de completar lo puede hacer el personal.
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

    // Transiciones: llegada → atención → completada.
    await page.getByRole("button", { name: "Registrar llegada" }).click();
    await expect(page.getByRole("button", { name: "Iniciar atención" })).toBeVisible();
    await page.getByRole("button", { name: "Iniciar atención" }).click();
    await expect(page.getByRole("button", { name: "Completar" })).toBeVisible();
    await page.getByRole("button", { name: "Completar" }).click();
    await expect(page.getByText("Completada").first()).toBeVisible();
  });

  test("la propietaria invitada al portal deja una reseña de 5 estrellas", async ({ page }) => {
    // El personal genera la invitación y captura el enlace (se muestra UNA vez).
    await iniciarSesion(page, correoAdmin);
    await page.goto("/app/propietarios");
    await page.getByRole("link", { name: /Pamela/ }).click();
    await expect(page).toHaveURL(/\/app\/propietarios\/[0-9a-f-]{36}/);
    await page.getByRole("button", { name: "Invitar al portal" }).click();
    const campoEnlace = page.getByLabel("Enlace de invitación");
    await expect(campoEnlace).toBeVisible();
    const enlace = await campoEnlace.inputValue();
    const rutaInvitacion = new URL(enlace).pathname;

    // Cuenta de la propietaria con el MISMO correo, conservando el retorno.
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto(`/registro?next=${encodeURIComponent(rutaInvitacion)}`);
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Pamela");
    await page.getByLabel("Apellidos").fill("Propietaria");
    await page.getByLabel("Correo electrónico").fill(correoPropietario);
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(contrasena);
    await page.getByLabel("Confirma tu contraseña").fill(contrasena);
    await page.getByLabel(/Acepto los términos/).check();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(new RegExp(rutaInvitacion.replaceAll("/", "\\/")));
    await page.getByRole("button", { name: "Aceptar invitación" }).click();
    await expect(page).toHaveURL(/\/mi\/mascotas/);

    // /mi/opiniones: la cita completada ofrece dejar opinión.
    await page.goto("/mi/opiniones");
    await expect(page.getByText("Motita", { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Dejar opinión" }).click();

    // Calificación de 5 estrellas + título + cuerpo.
    await page.getByRole("radio", { name: "5 estrellas" }).click();
    await page.getByRole("textbox", { name: "Título (opcional)", exact: true }).fill(tituloResena);
    await page
      .getByRole("textbox", { name: "Cuéntanos tu experiencia", exact: true })
      .fill(cuerpoResena);
    await page.getByRole("button", { name: "Publicar opinión" }).click();
    await expect(page.getByText("Tu opinión quedó publicada", { exact: false })).toBeVisible();
  });

  test("la reseña aparece en el perfil público de la clínica", async ({ page }) => {
    // Sin sesión: el perfil público muestra el promedio y el texto de la reseña.
    await page.context().clearCookies();
    await page.goto(`/clinicas/${slugClinica}#opiniones`);
    await expect(page.getByRole("heading", { name: "Opiniones" })).toBeVisible();
    await expect(page.getByText("1 opinión", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(cuerpoResena)).toBeVisible();
    await expect(page.getByText(tituloResena)).toBeVisible();
  });

  test("el personal responde la reseña y la respuesta sale en el perfil público", async ({
    page,
  }) => {
    await iniciarSesion(page, correoAdmin);
    await page.goto("/app/opiniones");
    await expect(page.getByText(cuerpoResena)).toBeVisible();
    await page.getByRole("button", { name: "Responder", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Tu respuesta pública", exact: true })
      .fill(respuestaClinica);
    await page.getByRole("button", { name: "Responder", exact: true }).click();
    await expect(page.getByText("Tu respuesta quedó publicada", { exact: false })).toBeVisible();

    // La respuesta pública aparece en el perfil de la clínica (sin sesión).
    await page.context().clearCookies();
    await page.goto(`/clinicas/${slugClinica}#opiniones`);
    await expect(page.getByText("Respuesta de la clínica").first()).toBeVisible();
    await expect(page.getByText(respuestaClinica)).toBeVisible();
  });
});
