# Dogtoralia 🐾

Plataforma SaaS mexicana para clínicas veterinarias, médicos veterinarios y propietarios de
mascotas: agenda de citas, expedientes clínicos, recetas y recordatorios — con aislamiento
total de datos entre clínicas.

> **Estado actual: Fase 11 (preparación de suscripciones).**
> `plans` y `subscriptions` (una por clínica, plan `beta` gratuito por trigger); restricción
> por plan disponible pero no bloqueante en beta; tarjeta «Plan» en el dashboard y desglose de
> suscripciones en el panel superadmin; scaffold de Stripe (`stripe-webhook`) sin cobros. Sobre
> el panel administrativo y métricas (Fase 10), los recordatorios automáticos (Fase 9), el
> portal público con reseñas (Fase 8/8.1) y el panel clínico de las Fases 1–7 (agenda
> anti-traslape, expediente inmutable, recetas y vacunación).
> **Dogtoralia no calcula dosis ni sugiere medicamentos.** Aislamiento RLS validado con
> pgTAP (556 aserciones; ver [ROADMAP.md](./ROADMAP.md), `docs/subscriptions/`, `docs/admin/`,
> `docs/notifications/reminders.md`, `docs/portal/` y
> [docs/security/rls-model.md](./docs/security/rls-model.md)).

## Documentación

| Documento                                            | Contenido                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Alcance del MVP, roles, riesgos, decisiones de producto         |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                 | Stack, principios, estructura del monorepo, seguridad y pruebas |
| [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)           | Modelo de datos, multi-tenancy con RLS, matriz de permisos      |
| [ROADMAP.md](./ROADMAP.md)                           | Fases de desarrollo con criterios de salida verificables        |
| [CLAUDE.md](./CLAUDE.md)                             | Reglas de ingeniería obligatorias para todo el proyecto         |

## Requisitos previos

| Herramienta  | Versión recomendada | Notas                                                    |
| ------------ | ------------------- | -------------------------------------------------------- |
| Node.js      | 22 LTS (`.nvmrc`)   | `nvm use` respeta la versión del repo                    |
| pnpm         | 10.x                | fijada en `packageManager` de `package.json`             |
| Docker       | reciente            | solo para Supabase local (`pnpm db:start`)               |
| Supabase CLI | 2.x                 | ya incluida como dependencia de desarrollo (`pnpm exec`) |

## Instalación

```bash
git clone <repo>
cd dogtoralia
pnpm install
cp .env.example apps/web/.env.local   # completa valores locales; NUNCA se commitea
```

Sin `.env.local` la app compila y muestra la portada, pero autenticación y panel requieren
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (los imprime `pnpm db:start`).
El correo funciona en modo dev sin configuración (`EMAIL_MODE=dev`, no envía nada real).
Las URLs de redirección que debe conocer Supabase Auth están en `.env.example` y
`docs/auth/authentication-flow.md`.

## Variables de entorno

Todas documentadas en [`.env.example`](./.env.example), agrupadas por servicio y marcadas como
`[PÚBLICA]` (prefijo `NEXT_PUBLIC_`, llegan al navegador) o `[PRIVADA]` (solo servidor).

- La validación vive en `apps/web/src/env.ts` (Zod + `@t3-oss/env-nextjs`): si una variable
  privada se importa en código de cliente, la app lanza un error — esa protección no se quita.
- La `service_role key` de Supabase jamás se usa en `apps/web`; solo en Edge Functions y CI.

## Supabase local

```bash
pnpm db:start    # levanta PostgreSQL + Auth + Storage en Docker (imprime URLs y llaves)
pnpm db:reset    # aplica supabase/migrations/ + seed.sql desde cero
pnpm db:test     # pruebas pgTAP (aislamiento RLS) con Supabase CLI
pnpm db:types    # regenera packages/types/src/database.types.ts desde el esquema
pnpm db:stop     # detiene los contenedores
```

- La configuración vive en `supabase/config.toml` (`project_id = "dogtoralia"`).
- Todo cambio de esquema es una migración nueva en `supabase/migrations/` (CLAUDE.md §15)
  acompañada de pruebas pgTAP y de la regeneración de tipos en el mismo PR.
- **Sin Docker**: usa `pnpm db:test:pg` (PostgreSQL 16 local + pgTAP con un shim del
  entorno Supabase). Guía completa: [docs/database/local-testing.md](./docs/database/local-testing.md).

## Comandos disponibles

| Comando           | Qué hace                                                          |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm dev`        | Servidor de desarrollo (web en http://localhost:3000)             |
| `pnpm build`      | Build de producción de todos los paquetes                         |
| `pnpm lint`       | ESLint en todo el monorepo                                        |
| `pnpm typecheck`  | `tsc --noEmit` en todos los paquetes                              |
| `pnpm test`       | Pruebas unitarias (Vitest)                                        |
| `pnpm test:e2e`   | Prueba E2E de la página (Playwright; requiere Chromium, ver §E2E) |
| `pnpm db:test`    | Pruebas de base de datos (pgTAP) vía Supabase CLI + Docker        |
| `pnpm db:test:pg` | Pruebas de base de datos sin Docker (PostgreSQL 16 local)         |
| `pnpm format`     | Prettier en todo el repo (`format:check` solo verifica)           |
| `pnpm db:*`       | Supabase local (ver sección anterior)                             |

### Pruebas

- **Unitarias**: `pnpm test`. Viven junto al código (`*.test.ts`), corren con Vitest desde la
  raíz. Ejemplo: `packages/validation/src/schemas/common.test.ts`.
- **E2E**: `pnpm test:e2e`. Playwright levanta `next dev` solo (puerto 3100) y verifica la
  carga de la página. La primera vez ejecuta
  `pnpm --filter @dogtoralia/web exec playwright install chromium`. En entornos con Chromium
  ya instalado: `PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium pnpm test:e2e`.

## Estructura del repositorio

```
dogtoralia/
├── apps/
│   └── web/                  # Next.js (App Router) — panel web
│       ├── src/app/          # rutas, layout y página de inicio
│       ├── src/lib/i18n/     # textos de UI en es-MX (nunca sueltos en JSX)
│       ├── src/env.ts        # validación de variables de entorno
│       └── e2e/              # pruebas Playwright
├── packages/
│   ├── ui/                   # componentes compartidos (Button, Card, Input, Label)
│   ├── config/               # presets de tsconfig + tema Tailwind de marca
│   ├── types/                # tipos de dominio + generados desde PostgreSQL
│   └── validation/           # esquemas Zod compartidos
├── supabase/
│   ├── migrations/           # SQL versionado (fuente de verdad del esquema)
│   ├── tests/database/       # pruebas pgTAP (aislamiento RLS)
│   ├── seed.sql              # datos de desarrollo (ficticios)
│   └── config.toml           # configuración de Supabase local
├── scripts/db/               # shim y runner para probar la BD sin Docker
├── docs/                     # ADRs, seguridad (RLS, roles) y guías de BD
├── .github/workflows/ci.yml  # lint + formato + typecheck + pruebas + build + E2E
└── .env.example              # plantilla documentada de variables de entorno
```

## Flujo de trabajo con Git

1. Crear rama desde `main`: `git checkout -b feat/nombre-corto`.
2. Commits pequeños y descriptivos (`feat: agenda — restricción anti-traslape`).
3. Antes de subir: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
4. Abrir PR hacia `main`; CI debe quedar en verde para fusionar.
5. Nunca push directo a `main`; nunca commitear `.env*` con valores reales.

## Solución de problemas frecuentes

| Problema                                     | Solución                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm install` ignora postinstalls           | Los binarios permitidos están en `pnpm.onlyBuiltDependencies` (package.json); es intencional.          |
| `db:start` falla con error de Docker         | Inicia Docker Desktop / daemon; sin Docker no hay Supabase local (el resto del repo funciona).         |
| Playwright: "Executable doesn't exist"       | `pnpm --filter @dogtoralia/web exec playwright install chromium`, o define `PLAYWRIGHT_CHROMIUM_PATH`. |
| Estilos de `@dogtoralia/ui` no aparecen      | Verifica el `@source "../../../../packages/ui/src"` en `apps/web/src/app/globals.css`.                 |
| Tipos de BD desactualizados                  | `pnpm db:types` tras aplicar migraciones (regla CLAUDE.md §18).                                        |
| Error de variables de entorno al hacer build | Revisa `apps/web/src/env.ts`: una variable requerida falta o tiene formato inválido.                   |

## Licencia

Propietario. Todos los derechos reservados — Dogtoralia.
