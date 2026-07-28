import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Flujos con Supabase REAL (E2E_AUTH=1): el servidor es `next dev`, que
// compila cada ruta bajo demanda en el primer acceso; una Server Action
// transaccional que redirige a una ruta aún no compilada puede superar los 5 s
// por defecto de Playwright (de ahí fallos "flaky" que pasan al reintentar con
// la ruta ya caliente). Por eso, en ese modo se amplían los timeouts de
// navegación/aserción y se acota la concurrencia (una sola BD compartida) sin
// serializar del todo. NO se debilita ninguna aserción — solo se da tiempo
// realista a un redirect correcto bajo la carga del CI.
//
// Además se eleva el timeout POR PRUEBA (`timeout`): estos flujos son largos
// (registro completo, reserva de invitado, ciclo de reseña de punta a punta) y
// encadenan muchos pasos con compilación JIT y una BD compartida; con el tope
// por defecto de 30 s una sola operación lenta agotaba el presupuesto de toda
// la prueba ("Test timeout of 30000ms exceeded"). El límite por operación
// (navegación/acción/aserción) sigue siendo estricto; solo se da margen al
// flujo completo.
const E2E_AUTH = process.env.E2E_AUTH === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: E2E_AUTH ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: E2E_AUTH ? 120_000 : 30_000,
  expect: { timeout: E2E_AUTH ? 20_000 : 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    navigationTimeout: E2E_AUTH ? 30_000 : undefined,
    actionTimeout: E2E_AUTH ? 20_000 : undefined,
    launchOptions: {
      // Permite usar un Chromium ya instalado en el sistema (p. ej. entornos sandbox
      // sin descarga de navegadores). En CI y desarrollo normal queda sin definir y
      // Playwright usa su navegador propio (`playwright install chromium`).
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
