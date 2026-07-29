# Suscripciones (Fase 11 — preparación)

Estado: **preparación**. La Fase 11 deja el modelo de suscripciones operativo y usable en la
capa web, pero **sin cobros reales**: en beta todo es gratuito y la restricción por plan es
informativa, no bloqueante. El cobro con Stripe Billing es post-MVP (ver `ROADMAP.md`).

## Modelo

- **Una suscripción por clínica.** Cada clínica tiene exactamente una fila en `subscriptions`
  que la vincula a un plan de `plans`. El aislamiento entre clínicas es innegociable
  (CLAUDE.md §3): la RLS garantiza que la clínica A no ve la suscripción de la clínica B.
- **Alta automática en beta.** Al crear una clínica, un trigger de base de datos inserta su
  suscripción al plan `beta` (gratuito). Así **toda clínica tiene plan** desde el minuto cero,
  sin pasos manuales ni ventanas sin cobertura.
- **Restricción por plan sin bloqueo en el MVP.** El sistema _puede_ restringir por plan (por
  ejemplo, el número de veterinarios incluidos), pero en beta el plan `beta` incluye un límite
  amplio y la UI solo **informa** si se supera; nunca impide operar. La lógica de límite vive
  en la base para poder activarse sin cambios de esquema cuando el producto lo decida.
- **Stripe como scaffold, sin cobros.** Existe la estructura de la Edge Function de webhook
  (`stripe-webhook`) y los campos `stripe_customer_id` / `stripe_subscription_id` en
  `subscriptions`, ambos **nullable**: en esta fase quedan vacíos. No se procesan pagos ni
  eventos reales de Stripe. El cobro se activa post-MVP.
- **Dinero e i18n.** Los precios se almacenan como enteros en centavos MXN (`price_cents`,
  CLAUDE.md §13). Los textos de UI viven en la capa de i18n (`mensajes.panel.plan`,
  `mensajes.admin.suscripciones`), nunca como cadenas sueltas.

## Tablas y enums

- **`plans`** — catálogo de planes. Lectura pública de los planes activos (`is_active`).
  Columnas relevantes: `code` (identificador estable, p. ej. `beta`), `name`, `scope`
  (`plan_scope`), `price_cents`, `currency`, `billing_interval`, `included_veterinarians`,
  `additional_veterinarian_price_cents` (nullable), `features` (jsonb de banderas).
- **`subscriptions`** — una por clínica. `clinic_id`, `organization_id`, `plan_id`, `status`
  (`subscription_status`), `current_period_start`, `current_period_end` (nullable),
  `stripe_customer_id` / `stripe_subscription_id` (nullable). RLS forzado: el personal
  operativo de la clínica, la administración de la organización y el superadmin **leen**; no
  hay política de escritura para el cliente (las altas ocurren por trigger / backend).
- **Enums**:
  - `plan_scope`: `clinic` | `organization`.
  - `billing_interval`: `month` | `year`.
  - `subscription_status`: `trialing` | `active` | `past_due` | `canceled`.

## RPCs (SECURITY DEFINER)

Todas con `search_path` fijo; `grant execute` a `authenticated` (y `service_role`), revocado a
`public` / `anon`.

- **`clinic_current_plan(p_clinic_id uuid) returns jsonb`** — plan vigente de la clínica:
  `{ plan_code, plan_name, status, included_veterinarians, price_cents, features }`. Solo
  personal operativo. Base de la tarjeta «Plan» del dashboard.
- **`clinic_active_veterinarian_count(p_clinic_id uuid) returns integer`** — veterinarios
  activos de la clínica.
- **`clinic_within_veterinarian_limit(p_clinic_id uuid) returns boolean`** — `true` si la
  clínica está dentro del límite de veterinarios de su plan (y `true` si no hay suscripción, por
  defensa). En beta siempre informa sin bloquear.

## Capa web

- **Dashboard de clínica** (`apps/web/src/app/app/inicio`): tarjeta «Plan» con nombre del plan,
  estado y veterinarios incluidos, más un aviso discreto si se supera el límite. Helper:
  `apps/web/src/lib/suscripciones/queries.ts` (`obtenerPlanDeClinica`), que tipa el jsonb de la
  RPC con una interfaz local y acceso defensivo (sin `any`).
- **Panel superadmin** (`apps/web/src/app/app/admin`): desglose de suscripciones por plan
  (conteo de clínicas por `plans.code`) y columna «Plan» en el listado de clínicas. Como el
  superadmin ve todas las `subscriptions` por RLS, se consulta directo con el cliente de
  servidor (`@/lib/supabase/server`) uniendo `subscriptions`+`plans`; jamás `service_role` en
  `apps/web`. Helpers en `apps/web/src/lib/admin/queries.ts`
  (`contarSuscripcionesPorPlan`, `mapaPlanesPorClinica`).

## Pruebas

- pgTAP suite **17** (`supabase/tests/database/17_suscripciones.sql`): alta automática y
  cobertura total (toda clínica recibe suscripción al plan `beta`), consulta del plan vigente,
  restricción por plan (un plan restrictivo marca exceso; `beta` no bloquea), RLS de
  suscripciones (aislamiento entre clínicas, superadmin ve todo, el cliente no escribe) y
  lectura pública de planes activos. **556 aserciones pgTAP totales** en la base.

## Migración

- `supabase/migrations/20260723100001_suscripciones.sql`.
