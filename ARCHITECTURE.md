# Dogtoralia — Arquitectura Técnica

> Versión 0.1 — Etapa de arquitectura. Documento de referencia para todas las decisiones técnicas.

## 1. Evaluación del stack propuesto

El stack propuesto es **adecuado para el MVP** y se confirma con ajustes menores:

| Capa                     | Tecnología                                     | Veredicto     | Notas                                                                                            |
| ------------------------ | ---------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| Frontend web             | Next.js 15+ (App Router) + TypeScript estricto | ✅ Confirmado | Server Components para el panel; SSR útil para futuros perfiles públicos con SEO.                |
| UI                       | Tailwind CSS + shadcn/ui (Radix)               | ✅ Confirmado | shadcn/ui aporta componentes accesibles sin dependencia de runtime pesada.                       |
| App móvil (propietarios) | Flutter                                        | ✅ Confirmado | Una base de código para iOS/Android; paquete oficial `supabase_flutter`.                         |
| Backend + BD             | Supabase (PostgreSQL 15+)                      | ✅ Confirmado | RLS es la pieza central del multi-tenant. Postgres estándar evita lock-in real.                  |
| Autenticación            | Supabase Auth                                  | ✅ Confirmado | JWT con claims personalizados; correo/contraseña + OAuth Google en MVP.                          |
| Archivos                 | Supabase Storage                               | ✅ Confirmado | Buckets privados con políticas por clínica/propietario.                                          |
| Lógica de servidor       | Supabase Edge Functions (Deno/TS)              | ✅ Añadido    | Necesario para recordatorios, generación de PDF y webhooks. No estaba explícito en la propuesta. |
| Tareas programadas       | `pg_cron` + Edge Functions                     | ✅ Añadido    | Motor de recordatorios sin infraestructura adicional.                                            |
| Push                     | Firebase Cloud Messaging                       | ✅ Confirmado | Solo mensajería; no se usa Firebase para nada más.                                               |
| Correo transaccional     | Resend                                         | ✅ Confirmado | Plantillas con React Email.                                                                      |
| Pagos (futuro)           | Stripe                                         | ✅ Confirmado | Stripe Billing para suscripciones; modelo de datos preparado desde el MVP.                       |
| Hosting web              | Vercel                                         | ✅ Confirmado |                                                                                                  |
| Repositorio              | Git (monorepo)                                 | ✅ Confirmado | Monorepo con pnpm workspaces + Turborepo.                                                        |

**Alternativa evaluada y descartada (por ahora):** backend propio (NestJS/Fastify + Prisma).
Da más control, pero duplica el costo de desarrollo del MVP (auth, storage, realtime, infra).
La regla de escape: toda la lógica de negocio no trivial vive en SQL versionado y en
`packages/types`/`packages/validation`, de modo que migrar de Supabase a Postgres
autogestionado + API propia sea un cambio de infraestructura, no una reescritura.

## 2. Diagrama general

```
┌─────────────────┐   ┌──────────────────┐   ┌───────────────────────┐
│  Panel Web       │   │  App Propietarios │   │  App Veterinarios     │
│  Next.js (Vercel)│   │  Flutter          │   │  (fase posterior)     │
└────────┬────────┘   └────────┬─────────┘   └───────────┬───────────┘
         │                     │                          │
         └──────────┬──────────┴──────────────────────────┘
                    ▼
        ┌───────────────────────────────────────────┐
        │                SUPABASE                    │
        │  ┌───────────┐  ┌──────────┐  ┌─────────┐ │
        │  │ PostgREST  │  │   Auth    │  │ Storage │ │
        │  │ (API REST) │  │  (JWT)    │  │(privado)│ │
        │  └─────┬─────┘  └──────────┘  └─────────┘ │
        │        ▼                                    │
        │  ┌───────────────────────────────────────┐ │
        │  │ PostgreSQL + RLS (aislamiento multi-  │ │
        │  │ clínica) + pg_cron (recordatorios)    │ │
        │  └───────────────────────────────────────┘ │
        │  ┌───────────────────────────────────────┐ │
        │  │ Edge Functions: notificaciones, PDF   │ │
        │  │ de recetas, invitaciones, webhooks    │ │
        │  └──────┬──────────────┬─────────────────┘ │
        └─────────┼──────────────┼───────────────────┘
                  ▼              ▼
           ┌───────────┐  ┌───────────┐   ┌────────────────┐
           │    FCM     │  │  Resend   │   │ Stripe (futuro) │
           │   (push)   │  │ (correo)  │   └────────────────┘
           └───────────┘  └───────────┘
```

## 3. Principios de arquitectura

1. **La base de datos es la frontera de seguridad.** Ninguna regla de aislamiento o permiso
   depende únicamente del cliente. RLS activo en toda tabla de datos; el frontend solo mejora UX.
2. **El esquema vive en el repositorio.** Migraciones SQL versionadas (`supabase/migrations`),
   aplicadas por CI. Nunca cambios manuales en producción.
3. **Compartir tipos, no duplicar lógica.** `packages/types` contiene los tipos generados desde
   la BD y tipos de dominio; `packages/validation` los esquemas Zod; ambos se consumen desde web
   y Edge Functions. Flutter genera sus modelos desde los mismos contratos.
   _(Nota de cambio: el diseño original proponía un solo `packages/shared`; se dividió en
   `ui/config/types/validation` para separar responsabilidades y evitar dependencias cruzadas —
   p. ej. las Edge Functions consumen `validation` sin arrastrar React. Las plantillas de correo
   (`packages/emails`) se crearán en la fase de invitaciones/notificaciones, no antes.)_
4. **Escrituras sensibles pasan por RPC.** Operaciones con invariantes (agendar cita, emitir
   receta, cerrar consulta) se implementan como funciones de PostgreSQL (`SECURITY DEFINER`
   auditadas) o Edge Functions, no como inserts directos desde el cliente.
5. **Todo en UTC por dentro, `America/Mexico_City` por fuera.** Columnas `timestamptz`;
   la conversión de zona ocurre en la capa de presentación.
6. **Los expedientes clínicos son casi inmutables.** Correcciones por adenda; `audit_log`
   registra quién cambió qué y cuándo.

## 4. Estructura del monorepo

> El árbol siguiente es la estructura **objetivo** del MVP completo. La Fase 1 materializó la
> raíz, `apps/web` (aún sin segmentos de rol), los cuatro `packages/` y `supabase/`;
> `apps/mobile` y las Edge Functions llegan en sus fases correspondientes. Los textos de UI en
> es-MX viven en `apps/web/src/lib/i18n/` (capa mínima tipada hasta adoptar una librería i18n).

```
dogtoralia/
├── apps/
│   ├── web/                    # Next.js — panel de clínicas y veterinarios
│   │   ├── src/
│   │   │   ├── app/            # App Router (rutas por segmento de rol)
│   │   │   │   ├── (auth)/     # login, registro, invitaciones
│   │   │   │   ├── (clinic)/   # panel de clínica: agenda, pacientes, expedientes
│   │   │   │   └── (admin)/    # superadministración Dogtoralia
│   │   │   ├── components/     # componentes UI (ui/ = shadcn, feature/ = dominio)
│   │   │   ├── features/       # lógica por módulo: appointments/, pets/, records/...
│   │   │   ├── lib/            # clientes supabase, utilidades, i18n
│   │   │   └── styles/
│   │   └── tests/
│   └── mobile/                 # Flutter — app de propietarios
│       ├── lib/
│       │   ├── features/       # auth/, pets/, appointments/, reminders/
│       │   ├── core/           # cliente supabase, tema, ruteo, l10n
│       │   └── main.dart
│       └── test/
├── packages/
│   ├── ui/                     # componentes UI compartidos (base shadcn/ui + Tailwind)
│   ├── config/                 # presets compartidos de tsconfig (y futuras configs)
│   ├── types/                  # tipos TS: dominio + generados desde PostgreSQL (supabase gen types)
│   └── validation/             # esquemas Zod compartidos (frontera de validación)
├── supabase/
│   ├── migrations/             # SQL versionado (fuente de verdad del esquema)
│   ├── functions/              # Edge Functions (Deno/TS)
│   │   ├── send-reminders/
│   │   ├── send-notification/
│   │   ├── generate-prescription-pdf/
│   │   └── invite-staff/
│   ├── seed.sql                # datos de desarrollo
│   └── tests/                  # pruebas de RLS y de funciones SQL (pgTAP)
├── docs/                       # documentación adicional (ADRs, guías)
├── .github/workflows/          # CI: lint, typecheck, pruebas, pruebas de RLS
├── .env.example                # variables de entorno documentadas, sin valores reales
├── package.json                # raíz del workspace (pnpm)
├── turbo.json
├── PRODUCT_REQUIREMENTS.md
├── ARCHITECTURE.md
├── DATABASE_DESIGN.md
├── ROADMAP.md
├── CLAUDE.md
└── README.md
```

## 5. Autenticación y autorización

### Identidad

- Supabase Auth con correo/contraseña y Google OAuth.
- Cada usuario tiene un perfil en `public.profiles` (1:1 con `auth.users`).
- El personal de clínica entra por **invitación** (correo con token); el propietario se
  registra en autoservicio.

### Autorización (tres niveles)

1. **Nivel plataforma**: `profiles.is_superadmin` (booleano, solo modificable por superadmin).
2. **Nivel organización**: tabla `organization_members (user_id, organization_id, role)`.
   Una organización (empresa) agrupa una o varias clínicas/sucursales y es el sujeto comercial
   de la suscripción (decisión confirmada §7.4 del PRD). Roles: `owner`, `admin`,
   `billing` (reservado para facturación) y `member`. El rol `owner` administra la
   organización y su facturación futura.
3. **Nivel clínica**: tabla `clinic_members (user_id, clinic_id, role)` con roles
   `clinic_admin | veterinarian | receptionist`. Un usuario puede pertenecer a varias clínicas
   con roles distintos.
4. **Propietarios**: no son miembros de clínica; su acceso deriva de la propiedad de sus
   mascotas (`pets.owner_id`).

Las políticas RLS consultan `clinic_members` mediante funciones SQL auxiliares
(`is_clinic_member(clinic_id, roles[])`) declaradas `STABLE` y `SECURITY DEFINER` para evitar
recursión y mantener las políticas legibles. Detalle completo de la matriz de permisos en
`DATABASE_DESIGN.md §6`.

## 6. Módulos del backend

| Módulo                                      | Mecanismo                                                | Notas                                                                                     |
| ------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| CRUD simple (mascotas, servicios, personal) | PostgREST + RLS                                          | Validación Zod en cliente, `CHECK`/`NOT NULL` en BD.                                      |
| Agendar/reprogramar cita                    | Función SQL `book_appointment(...)`                      | Valida disponibilidad y traslapes de forma atómica; restricción `EXCLUDE` como red final. |
| Cerrar consulta / emitir receta             | Función SQL + Edge Function (PDF)                        | La receta queda inmutable al emitirse.                                                    |
| Recordatorios                               | `pg_cron` (cada 15 min) → Edge Function `send-reminders` | Lee `notifications` pendientes, envía FCM/Resend, marca estado y reintenta con backoff.   |
| Invitación de personal                      | Edge Function `invite-staff`                             | Crea invitación, envía correo con Resend.                                                 |
| Auditoría                                   | Triggers `AFTER INSERT/UPDATE/DELETE` → `audit_log`      | Sobre tablas sensibles.                                                                   |
| Pagos (futuro)                              | Edge Function webhook Stripe                             | Actualiza `subscriptions`.                                                                |

### 6.1 Interfaz desacoplada de mensajería (decisión confirmada)

Toda salida de mensajes (correo, push y, en el futuro, WhatsApp) pasa por una interfaz de
proveedor desacoplada, de modo que cambiar de proveedor no toque el dominio:

```ts
interface MessageProvider {
  readonly channel: "email" | "push" | "whatsapp";
  send(message: OutboundMessage): Promise<SendResult>; // nunca lanza: devuelve éxito/fallo tipado
}
```

- Implementaciones previstas: `ResendEmailProvider`, `FcmPushProvider` y, post-MVP,
  `MetaWhatsAppProvider` (**Meta WhatsApp Cloud API** es el proveedor principal previsto).
- El dominio solo encola filas en `notifications`; la Edge Function `send-reminders` resuelve
  el proveedor por canal. Cambiar de proveedor = una implementación nueva + configuración.
- Estado: el canal de **correo** quedó implementado en la Fase 3
  (`apps/web/src/lib/email/`: contrato `EmailProvider`, adaptador Resend vía API REST y
  adaptador de desarrollo que no envía). Decisión de ubicación (Server Actions en lugar de
  Edge Function en esta fase): ADR 0002. Push y WhatsApp siguen pendientes por fase.

## 7. Manejo de errores y validación

- **Frontera de entrada**: todo dato externo se valida con Zod (`packages/shared/schemas`)
  antes de tocar la BD; Flutter replica las mismas reglas en sus validadores.
- **BD**: restricciones `NOT NULL`, `CHECK`, `UNIQUE`, `FOREIGN KEY`, `EXCLUDE` — la BD nunca
  confía en el cliente.
- **Errores de aplicación**: tipo `Result`/errores tipados por módulo; mensajes al usuario en
  español claro, sin exponer detalles internos; logging estructurado del lado servidor.
- **Edge Functions**: respuestas de error con código estable (`APPOINTMENT_OVERLAP`,
  `INVITE_EXPIRED`, ...) que la UI traduce a mensajes localizados.

## 8. Estrategia de pruebas

| Nivel                      | Herramienta                         | Qué cubre                                                                                             |
| -------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Pruebas de RLS/aislamiento | pgTAP (o SQL + supabase test) en CI | **Obligatorias**: cada política nueva incluye prueba de que la clínica B no ve datos de la clínica A. |
| Unitarias TS               | Vitest                              | Esquemas Zod, utilidades, lógica de dominio en `shared`.                                              |
| Componentes web            | Vitest + Testing Library            | Formularios y flujos críticos del panel.                                                              |
| E2E web                    | Playwright                          | Flujos: alta de clínica, agendar cita, emitir receta.                                                 |
| Flutter                    | `flutter test`                      | Widgets y lógica de features.                                                                         |
| CI                         | GitHub Actions                      | lint + typecheck + pruebas + migraciones aplicadas contra Postgres efímero.                           |

## 9. Seguridad y privacidad

- Sin secretos en el repositorio; `.env.example` documenta cada variable requerida.
- La `service_role key` de Supabase solo existe en Edge Functions y CI, jamás en clientes.
- Buckets de Storage privados; acceso por URL firmada de corta duración.
- Datos personales y clínicos: cumplimiento LFPDPPP — aviso de privacidad, consentimiento en el
  registro, diseño que permite ejercer derechos ARCO (exportación y baja de cuenta).
- `audit_log` inmutable (sin UPDATE/DELETE) para operaciones sensibles.
- Cabeceras de seguridad en Vercel (CSP, HSTS); dependencias auditadas en CI.

## 10. Decisiones técnicas — estado (actualizado 2026-07-19)

| #   | Decisión                   | Estado                                                                                                                                                                                                                               |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Dominio y correo remitente | **Pendiente.** Mientras tanto: variables `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` con valores de ejemplo en `.env.example`.                                                                           |
| 2   | Perfiles públicos          | **Resuelta.** Sí habrá, en fase posterior: `/clinicas/[slug]` y `/veterinarios/[slug]`, con SEO y reservación pública. Next.js SSR ya lo soporta; `slug` reservado en el modelo de datos.                                            |
| 3   | Canal WhatsApp             | **Resuelta.** Proveedor principal previsto: **Meta WhatsApp Cloud API**, tras la interfaz desacoplada de §6.1. Presupuesto por mensaje: pendiente al activarlo.                                                                      |
| 4   | Retención de expedientes   | **Resuelta (parcial).** Nunca se eliminan automáticamente; ciclo de vida de clínica `trial/active/past_due/suspended/cancelled/archived` con borrado lógico y auditoría. Plazo definitivo de retención: pendiente de revisión legal. |
| 5   | Estructura de planes       | **Resuelta.** Suscripción por clínica con N veterinarios activos incluidos y cobro futuro por veterinario adicional; organizaciones agrupan clínicas para planes de grupo futuros.                                                   |
