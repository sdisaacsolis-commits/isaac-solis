# Edge Function: `stripe-webhook`

**SCAFFOLD** de la Fase 11 (suscripciones). Recibe los webhooks de Stripe, **verifica la firma** y
**enruta** los eventos de suscripción hacia handlers esquemáticos. **El cobro NO está activo en el
MVP**: las suscripciones nacen en plan `beta` por trigger de la BD y esta función no mueve dinero ni
crea clientes.

> El flag `COBRO_ACTIVO` (en `index.ts`) está en `false`. Mientras así sea, los handlers **solo
> registran** el enrutamiento y **no mutan** `public.subscriptions`. La activación real del cobro
> (Stripe Checkout/Billing + escritura de estados) llega en una fase posterior del ROADMAP.

## Qué hace (hoy)

1. Acepta solo `POST`.
2. Exige `STRIPE_WEBHOOK_SECRET`; sin él responde `500`.
3. **Verifica la firma** del header `Stripe-Signature` (esquema `t=timestamp,v1=firma`): calcula el
   HMAC-SHA256 de `${t}.${body}` con el secreto (`crypto.subtle`) y lo compara **en tiempo
   constante** contra las firmas `v1` del header. Firma ausente o inválida → `400`.
4. Parsea el evento y **enruta por tipo** con un `switch`:
   - `customer.subscription.created` / `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Los handlers mapean el estado de Stripe al enum `subscription_status`
   (`trialing | active | past_due | canceled`) y **actualizarían** `public.subscriptions` por
   `stripe_subscription_id` con la `service_role`, pero **solo si `COBRO_ACTIVO` es `true`**. En el
   MVP registran y no mutan.
6. Responde `200 {"received": true}` a todo evento válido (aunque el handler sea no-op), para que
   Stripe no reintente. Nunca lanza al cliente; nunca registra el cuerpo del evento ni secretos.

## Variables de entorno

| Variable                    | Requerida  | Descripción                                                          |
| --------------------------- | ---------- | -------------------------------------------------------------------- |
| `STRIPE_WEBHOOK_SECRET`     | Sí         | Secreto de firma del endpoint de Stripe (`whsec_…`). Sin él → `500`. |
| `SUPABASE_URL`              | Solo cobro | URL del proyecto. Solo se usa cuando `COBRO_ACTIVO=true`.            |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo cobro | Llave `service_role`. **Solo** en Edge Functions/CI, nunca cliente.  |

> `STRIPE_WEBHOOK_SECRET` y la `service_role` **NUNCA** se commitean: van en el panel de Supabase
> (Function Secrets) o en el Vault, y en CI como secretos del repo. El `.env.example` lleva solo los
> nombres, sin valores.

## Cómo se registra el endpoint en Stripe

1. Despliega la función: `pnpm exec supabase functions deploy stripe-webhook`.
2. En el **Dashboard de Stripe → Developers → Webhooks → Add endpoint**, usa la URL pública de la
   función: `https://<PROJECT_REF>.functions.supabase.co/stripe-webhook`
3. Suscribe los eventos: `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
4. Copia el **Signing secret** (`whsec_…`) que muestra Stripe y guárdalo como
   `STRIPE_WEBHOOK_SECRET` en los Function Secrets de Supabase. Nunca en el repo.

Prueba local con la CLI de Stripe (opcional):

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

## Activación del cobro (fase posterior)

Cuando se active el cobro real, cambia `COBRO_ACTIVO` a `true` y completa la rama de mutación de los
handlers (ya esquematizada). Recién entonces la función escribirá estados en `public.subscriptions`.
El alcance y el diseño de esa fase se documentan antes de implementarse (regla de proceso del
proyecto).

## Desarrollo local

```bash
deno check index.ts
deno lint
deno fmt --check
```
