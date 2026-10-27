# ADR 0005 — Cobro de membresía (Fase 13)

- **Fecha**: 2026-10-27
- **Estado**: aceptada

## Contexto

El MVP opera en beta gratuita (ADR 0004) y producto decidió empezar a cobrar la membresía con
una referencia clara: **menos del 50 % de lo que cuesta Doctoralia MX**, cuyos planes publicados
(2026) van de $1,230 (Starter) a $1,950 (VIP) MXN/mes + IVA **por profesional**. Las decisiones
comerciales las aprobó el propietario: plan único «Profesional» a **$599 MXN/mes + IVA por
clínica** con 1 veterinario incluido y **$399/mes por veterinario adicional**; anual **$5,990**
(≈2 meses gratis; veterinario adicional anual $3,990). Clínicas nuevas: **prueba de 14 días sin
tarjeta**. Clínicas beta existentes: **60 días de gracia** y migran al plan Profesional. Al
vencer sin pago, el panel queda en **solo lectura**: los datos clínicos jamás se tocan
(CLAUDE.md §6) y la restricción vive en la base, no en la UI (§4).

## Decisiones

1. **Precio por clínica, no por profesional.** Diferenciador frente a la referencia de mercado
   (que cobra por profesional): $599 es ~49 % del Starter y ~31 % del VIP por un solo
   veterinario, y la brecha crece con equipos grandes incluso sumando los $399 del adicional.
   El catálogo vive en `plans` (centavos MXN, §13) con códigos estables `profesional` y
   `profesional_anual`; `beta` pasa a `is_active = false` (invisible para anon) pero las
   suscripciones beta existentes lo conservan durante su gracia de 60 días.

2. **Solo lectura por trigger genérico en la base.** La vigencia se decide con
   `clinic_subscription_is_current(clinic)`: `trialing`/`active` con periodo no vencido, o
   `past_due` con **7 días de tolerancia** (reintentos de cobro de Stripe). Un trigger
   `BEFORE INSERT/UPDATE/DELETE` (`enforce_active_subscription`) en las tablas operativas con
   `clinic_id` — y su variante `…_via(padre, fk)` para tablas hijas (contenido clínico,
   partidas de receta, etc.) — rechaza escrituras con el código estable `SUSCRIPCION_VENCIDA`
   (errcode 42501) cuando la clínica no está vigente. Las **lecturas nunca se bloquean**.
   Un `DO` valida contra `information_schema` que cada tabla/relación de la lista exista, para
   fallar en voz alta si el esquema divergiera.

3. **El backend nunca se bloquea.** El trigger deja pasar toda operación sin `auth.uid()`
   (service_role: webhook, cron, correcciones), y quedan exentas a propósito: `clinics` y
   `clinic_members` (administrar el equipo y renovar sigue permitido), `subscriptions`/`plans`
   (los gestiona el backend de cobro), reseñas y moderación (contenido del propietario),
   entidades compartidas entre clínicas (`pets`, `pet_owners`, `pet_owner_relationships`,
   `vaccines_catalog`: el expediente del paciente no pertenece a una sola clínica), contadores
   de folio, historiales append-only, outbox y documentos congelados (solo los escribe el
   sistema en flujos ya bloqueados aguas arriba) y `audit_log`.

4. **Checkout alojado por Stripe, sin SDK en el dominio.** El panel inicia una sesión de
   Stripe Checkout desde una Server Action detrás de la interfaz `ProveedorDePagos`
   (ARCHITECTURE.md §6.1): el proveedor concreto usa la API REST con `fetch` (dos llamadas
   form-encoded), así que no se agrega el SDK como dependencia (§22). Los precios se resuelven
   por `lookup_key` estable (`profesional_mensual`, `profesional_anual`,
   `vet_adicional_mensual`, `vet_adicional_anual`), creados idempotentemente por
   `scripts/stripe/setup-precios.mjs`. **Ningún dato de tarjeta toca nuestra base.**

5. **El webhook es la única pluma sobre `subscriptions`.** La Edge Function `stripe-webhook`
   (service_role; §2) vincula la suscripción al completarse el checkout (metadata
   `clinic_id`/`plan_code`) y mantiene estado y periodos con los eventos
   `customer.subscription.*` e `invoice.payment_failed`. El flag `COBRO_ACTIVO` ahora se lee
   del entorno de la función: apagado, el webhook solo registra (comportamiento del scaffold).

6. **Catálogo público por RPC curada.** La página `/precios` (y el panel) leen el catálogo con
   `list_public_plans()` (SECURITY DEFINER, grant a `anon`/`authenticated`), manteniendo la
   regla de que las rutas públicas no consultan tablas base.

## Consecuencias

- Una clínica vencida sigue **viendo** todo su historial (expedientes, citas, recetas) y puede
  renovar desde el panel; solo se pausan las escrituras operativas. Reactivar (webhook marca
  `active` con periodo futuro) restaura la operación sin tocar datos.
- Las clínicas beta no sufren un corte abrupto: 60 días de gracia con su plan actual.
- La activación del cobro es operativa, no de código: crear precios en Stripe, configurar
  secretos y encender `COBRO_ACTIVO` (runbook completo en `docs/subscriptions/billing.md`).
- Nuevas suites de prueba: la 19 cubre catálogo, prueba de 14 días, vigencia con tolerancia,
  bloqueo `SUSCRIPCION_VENCIDA`, lectura intacta, bypass del backend y reactivación; la 17 se
  actualizó al nuevo plan por defecto.
- Riesgo asumido: si Stripe entrega `customer.subscription.created` antes que
  `checkout.session.completed`, la primera actualización por `stripe_subscription_id` no
  encuentra fila; el handler de checkout la vincula después y el siguiente evento de
  suscripción la corrige (además consulta la suscripción en Stripe cuando hay
  `STRIPE_SECRET_KEY` configurada en la función).
