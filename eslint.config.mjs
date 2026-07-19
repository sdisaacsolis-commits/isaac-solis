// Configuración raíz de ESLint (flat config) para todo el monorepo.
// Cada paquete ejecuta `eslint .` y ESLint resuelve esta configuración desde la raíz.
import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "supabase/.temp/**",
      "**/next-env.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      // Orden consistente de imports en todo el proyecto (CLAUDE.md §11)
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      // Prohibido `any` salvo justificación excepcional comentada (CLAUDE.md §7)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Los errores nunca se silencian (CLAUDE.md §9)
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Reglas específicas de Next.js, solo para la app web
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
    settings: {
      next: {
        rootDir: "apps/web",
      },
    },
  },
  // Prettier al final para desactivar reglas de formato en conflicto
  prettier,
);
