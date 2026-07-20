# ADR 0001 — Fundación del monorepo (Fase 1)

- **Fecha**: 2026-07-19
- **Estado**: aceptada

## Contexto

La Fase 1 inicializa la base técnica del MVP (ver ROADMAP.md). Durante la implementación se
tomaron decisiones estructurales que se apartan o precisan el diseño original de la Fase 0.

## Decisiones

1. **`packages/shared` se dividió en `ui`, `config`, `types` y `validation`.**
   Separa responsabilidades y evita dependencias cruzadas (las Edge Functions consumirán
   `validation`/`types` sin arrastrar React). `packages/emails` se creará en la fase de
   invitaciones/notificaciones.
2. **Tailwind CSS v4 (configuración por CSS).** El tema de marca vive en
   `packages/config/tailwind/theme.css` como única fuente de identidad visual; los componentes
   de `packages/ui` consumen esos tokens semánticos (`primary`, `surface`, `ink`, ...).
3. **Componentes shadcn/ui escritos a mano en `packages/ui`** (Button, Card, Input, Label)
   siguiendo su patrón (Radix + CVA + tailwind-merge), en lugar de ejecutar el generador CLI:
   mantiene el control del código compartido en el monorepo y evita configuración extra del
   generador por app.
4. **ESLint flat config única en la raíz** con `typescript-eslint`, orden de imports
   (`simple-import-sort`) y reglas de Next.js aplicadas solo a `apps/web`.
5. **Sin Husky/lint-staged por ahora.** La verificación vive en los comandos `pnpm` y en CI;
   los git hooks complican entornos remotos/sandbox sin aportar garantías adicionales a un
   equipo de una persona. Se revalorará cuando crezca el equipo.
6. **Supabase CLI como dependencia de desarrollo** (`pnpm exec supabase ...`): asegura la misma
   versión para todo el equipo y CI, sin instalación global.
7. **Playwright con `executablePath` opcional** (`PLAYWRIGHT_CHROMIUM_PATH`): permite entornos
   con Chromium preinstalado (sandboxes) sin alterar el flujo normal (`playwright install`).

## Consecuencias

- Los imports internos usan `@dogtoralia/{ui,config,types,validation}`.
- Todo cambio de identidad visual se hace en `theme.css`, nunca componente por componente.
- La documentación rectora (ARCHITECTURE.md §4) refleja la nueva estructura de packages.
