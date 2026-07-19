# Dogtoralia 🐾

Plataforma SaaS mexicana para clínicas veterinarias, médicos veterinarios y propietarios de
mascotas: agenda de citas, expedientes clínicos, recetas y recordatorios — con aislamiento
total de datos entre clínicas.

> **Estado actual: Fase 0 — Arquitectura.** Todavía no hay código de aplicación; este
> repositorio contiene la documentación de producto y arquitectura que gobierna el desarrollo.

## Documentación

| Documento | Contenido |
|---|---|
| [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | Alcance del MVP, roles, riesgos, métricas de éxito |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack confirmado, principios, estructura del monorepo, seguridad y pruebas |
| [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) | Modelo de datos, multi-tenancy con RLS, matriz de permisos |
| [ROADMAP.md](./ROADMAP.md) | Fases de desarrollo con criterios de salida verificables |
| [CLAUDE.md](./CLAUDE.md) | Reglas de ingeniería obligatorias para todo el proyecto |

## Stack (resumen)

- **Web**: Next.js (App Router) + TypeScript estricto + Tailwind CSS + shadcn/ui, en Vercel.
- **Móvil (propietarios)**: Flutter.
- **Backend**: Supabase — PostgreSQL con Row Level Security, Auth, Storage, Edge Functions,
  `pg_cron`.
- **Notificaciones**: Firebase Cloud Messaging (push) + Resend (correo).
- **Pagos (futuro)**: Stripe.

## Requisitos de desarrollo (a partir de la Fase 1)

- Node.js 20+, pnpm 9+
- Supabase CLI (`supabase start` levanta Postgres local con Docker)
- Flutter SDK 3.x (solo para `apps/mobile`, a partir de la Fase 8)

## Primeros pasos (a partir de la Fase 1)

```bash
git clone <repo>
cd dogtoralia
pnpm install
cp .env.example .env.local   # completar con valores locales; nunca commitear
supabase start               # Postgres + Auth + Storage locales
supabase db reset            # aplica migraciones y seed
pnpm dev                     # panel web en http://localhost:3000
```

### Variables de entorno

Todos los secretos viven en variables de entorno; `.env.example` documenta cada una **sin
valores reales**. Nunca se commitean llaves. La `service_role key` de Supabase solo se usa en
Edge Functions y CI, jamás en código de cliente.

## Reglas de contribución

1. Leer [CLAUDE.md](./CLAUDE.md) antes de escribir código — sus reglas son obligatorias.
2. Todo cambio de esquema entra como migración SQL en `supabase/migrations/`.
3. Toda tabla nueva con datos de clínica requiere RLS y prueba de aislamiento.
4. CI en verde (lint, typecheck, pruebas) antes de fusionar.

## Licencia

Propietario. Todos los derechos reservados — Dogtoralia.
