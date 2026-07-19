import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Configuración raíz de Vitest: descubre pruebas unitarias en todos los paquetes.
// Las pruebas E2E (Playwright) viven en apps/web/e2e y se ejecutan con `pnpm test:e2e`.
export default defineConfig({
  resolve: {
    alias: {
      // Alias "@/" de apps/web (mismo mapeo que su tsconfig `paths`).
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/src/**/*.test.ts", "apps/**/src/**/*.test.{ts,tsx}"],
  },
});
