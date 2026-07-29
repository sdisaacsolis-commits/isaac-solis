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

## Fase 2 — Esquema base, identidad y tenancy ✅ (2026-07-19; confirmación CI/Docker pendiente)

- Entregado: 9 migraciones (`profiles` + trigger sobre `auth.users`, `reserved_slugs`,
  `organizations` + `organization_members` con protección de último owner,
  `clinics` con ciclo de vida `trial/active/past_due/suspended/cancelled/archived` y slug
  global, `clinic_members` con pertenencia obligatoria a la organización,
  `clinic_invitations` con tokens SHA-256, `audit_log` append-only, 8 funciones de
  seguridad y políticas RLS explícitas por operación, 3 RPCs transaccionales).
- Pruebas: 153 aserciones pgTAP en 5 suites (`supabase/tests/database/`), incluidas las
  12 pruebas de aislamiento exigidas; tipos generados desde el esquema real; validación
  Zod de tenancy con 38 pruebas unitarias; job de CI de base de datos.
- Documentación: `docs/security/rls-model.md`, `docs/security/roles-and-permissions.md`,
  `docs/database/local-testing.md`.
- **Criterio de salida**: CUMPLIDO en PostgreSQL 16 local (clúster efímero + shim de
  Supabase, `pnpm db:test:pg`): migraciones desde base limpia y 153/153 pruebas en verde.
  **Pendiente**: confirmar la misma suite sobre Supabase CLI + Docker (job de CI
  "Migraciones y pruebas RLS"), no disponible en el entorno de desarrollo usado.
- _Alcance movido_: la configuración de Supabase Auth (proveedores, flujo de registro en
  la app web) se hará con el flujo de alta de clínicas en la Fase 3; el trigger de
  creación automática de perfil ya está listo y probado.

## Fase 3 — Autenticación, onboarding, personal e invitaciones ✅ (2026-07-19; validación con Supabase real pendiente)

- Entregado: autenticación completa (registro, login, logout, recuperación y actualización
  de contraseña, confirmación de correo configurable) con `@supabase/ssr`; protección de
  rutas privadas en middleware + servidor; onboarding de 3 pasos (perfil → organización
  vía `create_organization_with_owner` → primera clínica vía `create_clinic_with_admin`);
  dashboard con datos reales; gestión de organización, clínicas (listado/detalle/edición/
  selector de activa) y personal; invitaciones con token hasheado (crear/reenviar/revocar/
  aceptar) y correo por interfaz desacoplada (adaptador Resend + adaptador dev).
- Base de datos: migraciones 0011 (vista segura `colleague_profiles`) y 0012 (RPCs
  `create_clinic_with_admin`, `resend_clinic_invitation`) con 18 aserciones pgTAP nuevas
  (171 totales, en verde sobre PostgreSQL local).
- Pruebas: 79 unitarias; E2E Playwright en dos niveles (8 sin Supabase siempre + 3 flujos
  completos con `E2E_AUTH=1`); CI con escaneo de secretos.
- **Criterio de salida**: cumplido en lo verificable localmente (lint, typecheck, unit,
  build, E2E básicas, 171 pgTAP). **Pendiente**: ejercitar los flujos con un Supabase
  real (`pnpm db:start` + `E2E_AUTH=1 pnpm test:e2e`) y el job de CI con Docker — este
  entorno no tiene daemon de Docker.
- _Alcance movido a fases siguientes_: activación de clínicas por superadmin (panel
  `(admin)`, Fase 10), servicios y horarios de veterinarios (Fase 5).

## Fase 4 — Propietarios y mascotas ✅ (2026-07-19; validación Supabase CLI/Storage real pendiente)

- Entregado: identidad global de mascotas y propietarios con TRES relaciones
  (propietario–mascota con contacto principal único, clínica–mascota con datos privados
  por clínica, propietario–clínica), alertas administrativas, consentimientos
  versionados, 7 migraciones (`202607193000*`), 8 funciones de acceso, 5 RPCs
  transaccionales, bucket privado `pet-photos` con políticas de Storage y procesamiento
  de imagen (sharp → WebP sin EXIF).
- Web: `/app/propietarios*` y `/app/mascotas*` (listados con búsqueda/paginación/filtros,
  altas con detección de duplicados advertida, fichas completas con foto firmada,
  propietarios múltiples, alertas) + métricas reales en el dashboard.
- Pruebas: 70 aserciones pgTAP nuevas (241 totales, incluidos los 23 casos exigidos),
  108 unitarias, E2E en dos niveles.
- **Criterio de salida**: cumplido en lo verificable localmente (241/241 pgTAP sobre
  PostgreSQL + shim con storage mínimo). **Pendiente**: suite sobre Supabase CLI/Docker
  y subida real de fotografías a Supabase Storage (procedimiento en
  docs/pets/testing.md).
- Documentación: `docs/pets/` (7 documentos).

## Fase 5 — Agenda de citas ✅ (2026-07-19)

- Función `book_appointment` con validación de disponibilidad y restricción anti-traslape.
- Vista de agenda (día/semana) por veterinario; crear, confirmar, cancelar, reprogramar,
  no-asistió; historial de reprogramaciones.
- Notificaciones internas de cambios de estado (tabla `notifications`, correo vía Resend).
- **Criterio de salida**: imposible crear traslape (prueba de concurrencia); flujo completo de
  estados operando con auditoría.
- **Entregado**: catálogo `clinic_services` (9 categorías, precios en centavos, colchones),
  horarios semanales + excepciones (8 tipos, `special_hours` agrega disponibilidad),
  `get_available_slots` (≤31 días), citas con folio `CIT-AAAA-NNNNNN` concurrencia-seguro,
  `EXCLUDE USING gist` sobre la ventana ocupada (colchones incluidos) en estados que ocupan
  agenda, máquina de estados en SQL (+ espejo TS), historial append-only por trigger, outbox
  de notificaciones idempotente (confirmación/recordatorios 24h-2h/cancelación/reagendado;
  email activo, whatsapp/push/sms preparados), walk-ins y urgencias auditadas, UI
  (`/app/agenda*`, `/app/configuracion/servicios*`, `/app/configuracion/horarios`),
  métricas reales en dashboard y 70 aserciones pgTAP nuevas (suites 09–10; 311 totales).
  Documentación en `docs/appointments/`. La garantía anti-traslape es estructural
  (`EXCLUDE`); ver nota de concurrencia en `docs/appointments/testing.md`. El disparador
  programado de recordatorios queda preparado (Edge Function + `CRON_SECRET`, fase
  posterior): hoy el outbox se procesa al operar el panel.

## Fase 6 — Expediente clínico ✅ (2026-07-20)

- `medical_records`, `consultations` (con cierre e inmutabilidad + adendas), `diagnoses`,
  `treatments`, `vaccinations`, `dewormings`, adjuntos.
- UI de consulta para el veterinario; recepción sin acceso al detalle médico (verificado por RLS).
- **Criterio de salida**: consulta completa registrable durante una cita; correcciones solo por
  adenda; auditoría completa. Cumplido (vacunas/desparasitaciones estructuradas quedan como
  extensión natural: los encounters ya las soportan por referencia; ver
  `docs/clinical/domain-model.md`).
- **Entregado**: consultas clínicas `clinical_encounters` (cita ≠ consulta; `draft` fusionado
  con `in_progress`: la consulta abierta ES el borrador) con folio `CON-AAAA-NNNNNN` por
  contador UPSERT, tipos scheduled/walk-in/urgencia/seguimiento, apertura idempotente desde
  cita (`start_encounter_from_appointment`) y walk-in con cita interna
  (`create_walk_in_encounter`); nota SOAP y exploración física 1:1 **versionadas** (control
  optimista: UPDATE con versión esperada, 0 filas = conflicto), vitales append-only,
  diagnósticos (principal único, certeza), tratamientos, seguimientos, archivos clínicos en
  bucket privado `clinical-files` (magic bytes, PDF/JPEG/PNG/WebP, URLs firmadas cortas,
  descarga e impresión auditadas vía `log_clinical_record_access`); finalización con
  requisitos mínimos (motivo, A+P; exploración/vitales omisibles con justificación),
  inmutabilidad de dos capas (RLS 0-filas + trigger `CONSULTA_INMUTABLE`), adendas
  append-only solo en finalizadas y anulación administrativa con motivo (contenido intacto,
  folio no reutilizado, fuera de métricas); privacidad por rol (recepción solo cabecera;
  asistentes ven contenido y capturan vitales) con auditoría redactada; UI completa
  (`/app/consultas*` con sala de espera, detalle por secciones, documento imprimible y
  expediente por mascota `/app/mascotas/[id]/expediente`), métricas en dashboard y 54
  aserciones pgTAP nuevas (suite 11; 365 totales). Migraciones `202607195000*`.
  Documentación en `docs/clinical/` (10 documentos).

## Fase 7 — Recetas y vacunación ✅ (2026-07-20)

- Emisión de receta ligada a consulta, partidas de medicamentos, documento con datos de
  clínica y cédula del veterinario; inmutable al emitirse. Alcance ampliado por producto:
  registro de vacunación (aplicadas + históricas), cartilla y recordatorios.
- **Criterio de salida**: documento imprimible correcto; receta emitida no editable.
  Cumplido (el PDF binario congelado queda como pendiente documentado en
  `docs/prescriptions/documents.md`: hoy la fuente de verdad es el contenido canónico
  congelado con hash SHA-256 y la vista imprimible determinista).
- **Entregado**: recetas `prescriptions` + `prescription_items` (todo texto clínico lo
  captura el veterinario: **sin cálculo de dosis ni sugerencias** en ninguna capa) con
  folio `REC-AAAA-NNNNNN` por contador UPSERT, borrador durante la consulta y **emisión
  solo con consulta finalizada** (`issue_prescription`: transaccional, `FOR UPDATE`,
  idempotente), snapshots de servidor (clínica, prescriptor+cédula, mascota con peso de la
  consulta, propietario), documento canónico congelado + SHA-256
  (`prescription_documents`, jamás se regenera), sustitución sin ciclos con ambos
  documentos conservados (`supersede_prescription`; el original pasa a `superseded` solo
  al emitir el sustituto) y anulación administrativa con motivo (`void_prescription`);
  inmutabilidad de dos capas (RLS 0-filas + triggers `RECETA_INMUTABLE` /
  `DOCUMENTO_INMUTABLE` con GUC transaccional). Vacunación: catálogo por organización
  **no prescriptivo** (`vaccines_catalog`; intervalo de refuerzo solo como ayuda
  editable), registros inmutables `vaccination_records` con snapshot de producto, fuentes
  que distinguen aplicación en clínica de registros históricos aportados, lote+caducidad
  validados (producto caducado rechazado), **idempotencia por `client_request_id`**,
  comprobante congelado, próxima dosis siempre confirmada por veterinario, recordatorios
  por outbox idempotente (`vaccination_notifications`, correo; claim/mark con `SKIP
LOCKED`) y anulación que cancela recordatorios; cartilla consolidada dinámica con
  distinción visual por fuente. UI (`/app/recetas*`, `/app/vacunacion*`,
  `/app/mascotas/[id]/{recetas,vacunacion}`, `/app/configuracion/vacunas`), impresión
  desde snapshots congelados con hash visible y firma autógrafa (sin firma digital
  simulada), métricas no sensibles en dashboard, 76 aserciones pgTAP nuevas (suite 12;
  441 totales). Migraciones `202607206000*`. Documentación en `docs/prescriptions/` (6) y
  `docs/vaccination/` (7). Fuera de alcance: sustancias controladas, interacciones,
  inventario, firma certificada (documentado).

## Fase 8 — Portal público y reservación en línea (paridad Doctoralia) ✅ (2026-07-21)

- Dirección aprobada por el propietario del producto (2026-07-21); auditoría y plano en
  `docs/product/doctoralia-audit.md` y `doctoralia-parity.md`.
- **Entregado**: superficie pública 100 % por RPCs `SECURITY DEFINER` curadas (anon jamás
  lee tablas base; solo clínicas `is_public`): búsqueda/perfiles/ciudades, perfil de
  clínica `/clinicas/[slug]` con equipo y cédulas, perfiles públicos opt-in de
  veterinarios `/veterinarios/[slug]` (`veterinarian_public_profiles`, slug global con
  reservados protegidos), directorios SEO `/veterinarios/[ciudad]` y
  `/servicios/[categoria]/[ciudad]`, huecos reales públicos (`get_available_slots`
  re-emitida con bypass GUC transaccional solo para clínicas con
  `accepts_online_booking`) y **reservación de invitado sin cuenta**
  (`request_public_appointment`: propietario+mascota mínimos sin verificar, cita
  `requested` fuente `owner_portal` que NO ocupa agenda hasta confirmarse, folio real,
  idempotencia por request_id, límite 5/correo/24 h, rastro en
  `public_booking_requests` + auditoría). Portal del propietario `/mi` con vinculación
  SIEMPRE por invitación explícita de la clínica (`portal_invitations`, token hasheado,
  7 días, un uso) y lecturas curadas (`get_my_pets/appointments/pet_history` sin notas
  internas ni SOAP) + `cancel_my_appointment` (hasta 2 h antes, aviso por outbox).
  Panel: solicitudes en línea en la agenda, invitar al portal desde el propietario,
  perfil público del veterinario y visibilidad pública de la clínica. Suite pgTAP 13
  (33 aserciones; 474 totales), Zod es-MX y E2E. Documentación en `docs/portal/`.
  Reseñas verificadas quedan como Fase 8.1 (plan en `doctoralia-parity.md` §3-B).

## Fase 8.1 — Reseñas verificadas ✅ (2026-07-28)

- **Entregado**: opiniones ligadas a una cita **completada** del propietario que asistió
  (verificación estructural por trigger; una por cita vía índice único), calificación 1–5
  - texto, respuesta pública de la clínica y **moderación elevada** (ocultar/restaurar solo
    administración de la organización, con motivo y auditoría; el contenido del propietario
    jamás se edita ni se borra). Promedio de calificación (`clinic_rating`) integrado en la
    búsqueda y los perfiles públicos; lectura pública curada `get_clinic_reviews` (solo
    publicadas, autor enmascarado; anon nunca lee la tabla). RPCs `submit_review`,
    `update_my_review` (ventana 30 días), `reply_to_review`, `report_review`,
    `set_review_visibility`, `get_my_reviewable_appointments`. UI: estrellas y opiniones en
    perfiles y resultados, "Dejar opinión" en el portal del propietario y moderación en el
    panel. Suite pgTAP 14 (31 aserciones; 505 totales), Zod es-MX y E2E. Migraciones
    `202607228000*`. Documentación en `docs/portal/reviews.md`.

## Fase 8 (anterior) — App móvil de propietarios (Flutter)

- Registro/inicio de sesión, perfil de mascotas, solicitud y cancelación de citas,
  historial (consultas, vacunas, recetas de sus mascotas), tokens FCM.
- **Criterio de salida**: flujo propietario completo en Android e iOS (builds de desarrollo).

## Fase 9 — Recordatorios automáticos ✅ (2026-07-29)

- Edge Function `send-reminders` (Deno + `service_role`) procesa los outbox de cita
  (recordatorio 24 h antes) y de vacuna (próxima, 7 días antes) con correo (Resend/dev);
  RPCs batch cross-clínica reservadas a `service_role`; reintentos limitados (≤5) y estado
  terminal; idempotencia por `idempotency_key UNIQUE`. Cimientos de push: `device_tokens`
  (RLS por dueño) + `register_device_token`. Programación (cron) documentada para la nube
  (`pg_cron` + `pg_net` con secreto en Supabase Vault, o Vercel Cron). Decisiones: ADR 0003;
  guía: `docs/notifications/reminders.md`. Pruebas: pgTAP 15 (22 aserciones).
- **[Propuesta]** de seguimiento (fuera del alcance verificable de esta fase): envío **push**
  a propietarios (mapear propietario → usuario → tokens) y **desparasitaciones** próximas
  (requiere la tabla base `dewormings`, aún inexistente).
- **Criterio de salida**: recordatorios entregados y registrados; fallos reintentados; nada
  se envía dos veces. ✅ (canal correo; push como cimiento).

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
