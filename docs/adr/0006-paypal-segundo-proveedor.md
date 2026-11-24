# ADR 0006 — PayPal como segundo proveedor de pagos (Fase 14)

- **Fecha**: 2026-11-24
- **Estado**: aceptada

## Contexto

El cobro de membresía (Fase 13, ADR 0005) salió con Stripe (tarjetas). El propietario pidió
recibir pagos también por **PayPal**, a la cuenta Business de AniMALL. La interfaz
`ProveedorDePagos` (ARCHITECTURE.md §6.1) se diseñó precisamente para poder sumar proveedores
sin tocar el dominio: planes, prueba de 14 días, vigencia y solo lectura al vencer son
agnósticos del proveedor.

## Decisiones

1. **Mismo contrato, segunda implementación.** `proveedorPaypal` implementa
   `crearSesionCheckout` con la API REST de PayPal Subscriptions vía `fetch` (igual que el
   proveedor Stripe: sin SDK, cero dependencias nuevas, §22). El panel manda `proveedor`
   (`stripe`|`paypal`, Zod en `packages/validation`) y la Server Action elige la
   implementación; las URLs de retorno y los códigos de error son los mismos.

2. **Catálogo por nombre estable, sin IDs quemados.** `scripts/paypal/setup-precios.mjs`
   crea (idempotente) el producto de id fijo `DOGTORALIA-MEMBRESIA` y los planes
   `profesional_mensual` ($599 MXN/mes) y `profesional_anual` ($5,990/año) con IVA 16 %
   **exclusivo** (`taxes.percentage=16, inclusive=false`); el proveedor los resuelve listando
   los planes del producto por nombre (análogo a las lookup keys de Stripe).

3. **Veterinarios adicionales por override de precio.** Una suscripción de PayPal admite un
   solo plan (sin line items como Stripe); el precio del ciclo se sobrescribe POR suscripción
   (`plan.billing_cycles[].pricing_scheme.fixed_price`) con el total base + $399/vet mensual
   (o $3,990 anual). El plan del catálogo no cambia. La clínica viaja en `custom_id`.

4. **Webhook propio, mismas reglas.** La Edge Function `paypal-webhook` (service_role, §2) es
   la única pluma de PayPal sobre `subscriptions`: verifica cada entrega con el endpoint
   oficial `verify-webhook-signature` (`PAYPAL_WEBHOOK_ID` + credenciales REST) y mapea
   ACTIVATED/RE-ACTIVATED/UPDATED→`active`, SUSPENDED/PAYMENT.FAILED→`past_due`,
   CANCELLED/EXPIRED→`canceled`; `PAYMENT.SALE.COMPLETED` refresca el fin del periodo
   consultando la suscripción (`next_billing_time`). Mismo flag `COBRO_ACTIVO`.

5. **Esquema generalizado, no reescrito.** `subscriptions` gana `payment_provider`
   (`stripe`|`paypal`, CHECK) y `paypal_subscription_id` (único parcial); las columnas
   `stripe_*` existentes se conservan y se etiquetan con backfill. Migración
   `20261124500001`, suite pgTAP 20 (596 aserciones totales).

## Consecuencias

- Una clínica puede contratar con tarjeta o con PayPal; el estado converge en la misma fila
  de `subscriptions` y el solo-lectura/reactivación funcionan igual con ambos.
- El IVA en PayPal lo suma PayPal (16 % exclusivo); en Stripe lo gestiona Stripe Tax. En ambos
  los montos del catálogo van sin IVA.
- Riesgo asumido: los eventos de PayPal no garantizan `custom_id` en todos los tipos; el
  webhook cae al respaldo por `paypal_subscription_id` y, en `PAYMENT.SALE.COMPLETED`,
  consulta la suscripción para obtener la clínica y el periodo exactos.
- Mercado Pago queda como siguiente candidato natural bajo la misma interfaz **[Propuesta]**.
