import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Los flujos con Supabase REAL (E2E_AUTH=1) comparten UNA instancia de base de
// datos y UN dev server; ejecutarlos en paralelo genera contención (p. ej. la
// acción transaccional del walk-in queda a medias). En ese modo se serializan
// con un solo worker. Las suites básicas (sin Supabase) siguen en paralelo.
const E2E_AUTH = process.env.E2E_AUTH === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !E2E_AUTH,
  workers: E2E_AUTH ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
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
