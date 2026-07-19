import { defineConfig } from "vitest/config";

// Configuración raíz de Vitest: descubre pruebas unitarias en todos los paquetes.
// Las pruebas E2E (Playwright) viven en apps/web/e2e y se ejecutan con `pnpm test:e2e`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.{ts,tsx}"],
  },
});
