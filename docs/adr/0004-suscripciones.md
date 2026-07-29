# ADR 0004 — Preparación de suscripciones (Fase 11)

- **Fecha**: 2026-07-29
- **Estado**: aceptada

## Contexto

El MVP necesita el andamiaje de planes y suscripciones para poder, más adelante, cobrar y
restringir por plan — pero la beta es **gratuita** y no debe bloquear a ninguna clínica. Hacía
falta un modelo que (a) garantice que toda clínica tenga un plan desde su creación, (b) permita
al sistema restringir por plan sin activarlo todavía, y (c) deje lista la integración con Stripe
sin procesar cobros reales. Todo bajo las reglas del proyecto: aislamiento RLS entre clínicas
(CLAUDE.md §3), autorización en la base (§4), dinero en centavos (§13) y proveedores externos
tras una interfaz desacoplada (§18b).

## Decisiones

1. **Suscripción por clínica, no por organización.** La unidad de cobro y de límites es la
   clínica: `subscriptions` lleva una fila por `clinic_id` (con su `organization_id`) y RLS de
   aislamiento por clínica. Una organización con varias clínicas tiene varias suscripciones.
   El enum `plan_scope` (`clinic`/`organization`) deja la puerta abierta a planes de alcance
   organizacional en el futuro sin cambiar el esquema.

2. **Alta automática por trigger.** Al crear una clínica, un trigger inserta su suscripción al
   plan `beta` (gratuito, sembrado en la migración). Así **toda clínica tiene plan** sin pasos
   manuales ni ventanas sin cobertura, y el invariante «una suscripción por clínica» se cumple
   en la base, no en la app (CLAUDE.md §16–17).

3. **Restricción por plan disponible pero no bloqueante en beta.** La lógica de límite vive en
   la base (`clinic_current_plan`, `clinic_active_veterinarian_count`,
   `clinic_within_veterinarian_limit`, todas SECURITY DEFINER con grant a `authenticated`). El
   plan `beta` incluye un límite amplio de veterinarios; la UI solo **informa** cuando se supera
   el incluido y nunca impide operar. Cuando producto decida activar el bloqueo, se hace sin
   cambios de esquema.

4. **Stripe como scaffold, sin cobros.** Se prepara la estructura de la Edge Function de webhook
   (`stripe-webhook`) y las variables de entorno, pero no se procesan pagos ni eventos reales.
   El cobro con Stripe Billing es post-MVP. El dominio no importa el SDK de Stripe directamente:
   la integración vive en su Edge Function (único lugar, junto con CI, donde puede usarse
   `service_role`; CLAUDE.md §2, §18b).

5. **Identificadores de Stripe nullable.** `subscriptions.stripe_customer_id` y
   `stripe_subscription_id` son nullable: en beta quedan vacíos y se poblarán cuando el cobro
   real se active. No condicionan el alta ni la operación de la clínica.

## Consecuencias

- Toda clínica opera con un plan desde su creación; la capa web puede mostrar el plan vigente
  (dashboard) y el desglose de suscripciones (superadmin) leyendo bajo RLS, sin `service_role`
  en `apps/web`.
- El modelo puede empezar a restringir por plan con un cambio de configuración/producto, no de
  esquema; el bloqueo real y el cobro quedan como trabajo post-MVP (ver `ROADMAP.md`).
- Pruebas: pgTAP suite 17 cubre alta automática, plan vigente, restricción por plan, RLS de
  aislamiento y planes públicos (556 aserciones totales). Migración `20260723100001`.
