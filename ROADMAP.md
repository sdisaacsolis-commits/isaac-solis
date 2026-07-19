# Dogtoralia — Roadmap de Desarrollo

> Versión 0.1 — Fases pequeñas y verificables. Cada fase termina con criterios de aceptación
> comprobables y pruebas en verde antes de pasar a la siguiente. No se avanza con criterios
> pendientes.

## Fase 0 — Arquitectura y documentación ✅ (esta entrega)

- Análisis de alcance, riesgos, arquitectura, modelo de datos, roles y roadmap.
- Documentos: PRODUCT_REQUIREMENTS, ARCHITECTURE, DATABASE_DESIGN, ROADMAP, README, CLAUDE.
- **Criterio de salida**: documentación validada por el propietario del producto.

## Fase 1 — Fundación del monorepo ✅ (completada 2026-07-19)

- Estructura pnpm workspaces + Turborepo (`apps/web`, `packages/{ui,config,types,validation}`,
  `supabase/`).
- Next.js (App Router) con TypeScript estricto, Tailwind CSS v4, componentes base patrón
  shadcn/ui (Button, Card, Input, Label), ESLint (flat config) + Prettier + orden de imports.
- Página inicial en es-MX con capa mínima de i18n y tema de marca centralizado
  (`packages/config/tailwind/theme.css`).
- Supabase configurado (`config.toml`, migración de infraestructura, `seed.sql`) y
  `.env.example` documentado; validación de variables con protección cliente/servidor.
- Pruebas: Vitest (14 unitarias de `packages/validation`) + Playwright (smoke E2E de la página).
- CI (GitHub Actions): lint, formato, typecheck, pruebas, build + job E2E.
- **Criterio de salida**: cumplido — `pnpm lint/typecheck/test/build` en verde y página base
  funcionando en desarrollo (verificado con Playwright).
- _Nota_: `supabase start` requiere Docker; en el entorno de desarrollo remoto usado para esta
  fase no hay daemon disponible, por lo que el stack local se verificará en máquina del equipo
  (la configuración ya está lista y versionada).

## Fase 2 — Esquema base, identidad y tenancy

- Migraciones: `profiles`, `organizations`, `organization_members`, `clinics` (con ciclo de
  vida `trial/active/past_due/suspended/cancelled/archived` y `slug` reservado),
  `clinic_members`, `clinic_invitations`, `audit_log`, funciones auxiliares de RLS y triggers
  de auditoría/`updated_at`.
- Supabase Auth (correo/contraseña) + creación automática de perfil.
- **Pruebas de RLS de aislamiento entre clínicas (pgTAP) — bloqueantes.**
- **Criterio de salida**: usuario de clínica A no puede leer/escribir nada de clínica B
  (demostrado por pruebas automatizadas).

## Fase 3 — Registro de clínicas y personal

- Flujo de alta de clínica y activación por superadmin (panel `(admin)`).
- Invitación de personal por correo (Edge Function + Resend) y aceptación con creación de cuenta.
- Gestión de personal, servicios (precios MXN en centavos) y horarios de veterinarios.
- **Criterio de salida**: una clínica real puede quedar configurada de punta a punta.

## Fase 4 — Propietarios y mascotas (web)

- Registro de propietario desde recepción; perfil de mascota completo con fotografía
  (Storage privado).
- Búsqueda de mascotas/propietarios dentro de la clínica.
- **Criterio de salida**: recepción registra propietario + mascota en menos de 2 minutos.

## Fase 5 — Agenda de citas

- Función `book_appointment` con validación de disponibilidad y restricción anti-traslape.
- Vista de agenda (día/semana) por veterinario; crear, confirmar, cancelar, reprogramar,
  no-asistió; historial de reprogramaciones.
- Notificaciones internas de cambios de estado (tabla `notifications`, correo vía Resend).
- **Criterio de salida**: imposible crear traslape (prueba de concurrencia); flujo completo de
  estados operando con auditoría.

## Fase 6 — Expediente clínico

- `medical_records`, `consultations` (con cierre e inmutabilidad + adendas), `diagnoses`,
  `treatments`, `vaccinations`, `dewormings`, adjuntos.
- UI de consulta para el veterinario; recepción sin acceso al detalle médico (verificado por RLS).
- **Criterio de salida**: consulta completa registrable durante una cita; correcciones solo por
  adenda; auditoría completa.

## Fase 7 — Recetas

- Emisión de receta ligada a consulta, partidas de medicamentos, PDF (Edge Function) con
  datos de clínica y cédula del veterinario; inmutable al emitirse.
- **Criterio de salida**: PDF descargable e imprimible correcto; receta emitida no editable.

## Fase 8 — App móvil de propietarios (Flutter)

- Registro/inicio de sesión, perfil de mascotas, solicitud y cancelación de citas,
  historial (consultas, vacunas, recetas de sus mascotas), tokens FCM.
- **Criterio de salida**: flujo propietario completo en Android e iOS (builds de desarrollo).

## Fase 9 — Recordatorios automáticos

- `pg_cron` + Edge Function `send-reminders`: recordatorio de cita (24 h antes), vacunas y
  desparasitaciones próximas; push (FCM) + correo (Resend) con estado y reintentos.
- **Criterio de salida**: recordatorios entregados y registrados; fallos reintentados; nada
  se envía dos veces.

## Fase 10 — Panel administrativo y métricas

- Dashboard de clínica: resumen del día, citas pendientes de confirmar, métricas básicas
  (citas por periodo, cancelaciones, inasistencias).
- Panel superadmin: clínicas, activaciones, actividad global.
- **Criterio de salida**: métricas correctas contra datos de prueba conocidos.

## Fase 11 — Preparación de suscripciones

- `plans` y `subscriptions` operativos con plan `beta` gratuito asignado automáticamente.
- Estructura de Edge Function para webhooks de Stripe (sin activar cobros).
- **Criterio de salida**: toda clínica tiene suscripción; el sistema puede restringir por plan.

## Fase 12 — Endurecimiento y beta

- Auditoría de seguridad interna (revisión de todas las políticas RLS), pruebas E2E de los
  flujos críticos, revisión de accesibilidad, aviso de privacidad, textos legales.
- Beta con 1–3 clínicas reales.
- **Criterio de salida**: sin hallazgos críticos; clínicas beta operando.

## Post-MVP (backlog priorizado — decisiones 1 y 2 ya confirmadas por producto)

1. Recordatorios y confirmación de citas por **WhatsApp** — proveedor confirmado:
   Meta WhatsApp Cloud API, tras la interfaz desacoplada de mensajería (ARCHITECTURE.md §6.1).
2. Perfiles públicos de clínicas y veterinarios (`/clinicas/[slug]`, `/veterinarios/[slug]`)
   con SEO y reservación pública — confirmado.
3. App/interfaz móvil para veterinarios.
4. Cobro real de suscripciones con Stripe Billing.
5. Exportación ARCO de datos del propietario.
6. Inventario básico y punto de venta.
