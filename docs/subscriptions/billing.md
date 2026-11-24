# Cobro de membresía — runbook de activación (Fase 13)

Modelo comercial aprobado (2026-10-27): plan **Profesional** $599 MXN/mes + IVA por clínica
(1 veterinario incluido; +$399/mes por veterinario adicional); anual $5,990 (≈2 meses gratis;
veterinario adicional anual $3,990). Clínicas nuevas: prueba de 14 días sin tarjeta. Clínicas
beta existentes: 60 días de gracia. Al vencer: panel en **solo lectura** (los datos jamás se
tocan). Decisiones y diseño: `docs/adr/0005-cobro-de-membresia.md`.

## Piezas

| Pieza                                          | Dónde                                | Qué hace                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migración `20261027500001_cobro_membresia.sql` | `supabase/migrations/`               | Planes comerciales, beta inactivo + gracia 60 días, prueba 14 días, `clinic_subscription_is_current`, triggers de solo lectura, `list_public_plans` |
| `/precios`                                     | `apps/web/src/app/(portal)/precios/` | Página pública del catálogo (RPC curada, FAQ con JSON-LD)                                                                                           |
| `/app/facturacion`                             | `apps/web/src/app/app/facturacion/`  | Estado de la membresía + contratación (solo administradores)                                                                                        |
| `ProveedorDePagos`                             | `apps/web/src/lib/facturacion/`      | Interfaz del proveedor (18b) + implementación Stripe por REST                                                                                       |
| Edge Function `stripe-webhook`                 | `supabase/functions/stripe-webhook/` | Única pluma sobre `subscriptions`; detrás de `COBRO_ACTIVO`                                                                                         |
| `scripts/stripe/setup-precios.mjs`             | `scripts/stripe/`                    | Alta idempotente de productos/precios con `lookup_key` estables                                                                                     |
| Suite pgTAP 19                                 | `supabase/tests/database/`           | Catálogo, prueba, vigencia, solo lectura, bypass backend, reactivación                                                                              |

## Activación del cobro (pasos del operador)

1. **Cuenta de Stripe** (modo live) con los datos fiscales de la empresa. Anotar la llave
   secreta `sk_live_…` (Developers → API keys). Recomendado: activar Stripe Tax para el IVA
   (los precios se crean con `tax_behavior=exclusive`).
2. **Crear el catálogo de precios** (idempotente, se puede reejecutar):

   ```bash
   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe/setup-precios.mjs
   ```

3. **Configurar el endpoint del webhook** en Stripe (Developers → Webhooks → Add endpoint):
   - URL: `https://izixhghxlmsfjwsbohxt.functions.supabase.co/stripe-webhook`
   - Eventos: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Anotar el signing secret `whsec_…`.
4. **Secretos de la Edge Function** (la service_role ya la inyecta Supabase):

   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... \
     STRIPE_SECRET_KEY=sk_live_... COBRO_ACTIVO=true \
     --project-ref izixhghxlmsfjwsbohxt
   ```

5. **Variable del servidor web** (Vercel → Settings → Environment Variables, solo servidor):
   `STRIPE_SECRET_KEY=sk_live_…` y redeploy. Sin ella, `/app/facturacion` muestra el catálogo
   pero el checkout responde `estado=error` (código `FACTURACION_NO_CONFIGURADA` en el log).
6. **Probar en modo test primero**: repetir 1-5 con `sk_test_…`/webhook de test, pagar con la
   tarjeta `4242 4242 4242 4242` y verificar que `subscriptions` quede `active` con
   `stripe_customer_id`/`stripe_subscription_id` poblados y periodo futuro.

## PayPal (Fase 14 — cuenta Business de AniMALL)

La membresía también puede pagarse con PayPal; el panel muestra ambos botones por plan. Diseño:
`docs/adr/0006-paypal-segundo-proveedor.md`. Activación (independiente de Stripe):

1. **Credenciales REST**: en [developer.paypal.com](https://developer.paypal.com) con la cuenta
   Business de AniMALL → Apps & Credentials → **Live** → Create App. Anotar `Client ID` y
   `Secret`.
2. **Crear catálogo y webhook** (idempotente; también imprime el `PAYPAL_WEBHOOK_ID`):

   ```bash
   PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... node scripts/paypal/setup-precios.mjs
   ```

   Crea el producto `DOGTORALIA-MEMBRESIA`, los planes `profesional_mensual` ($599 MXN/mes) y
   `profesional_anual` ($5,990/año) con IVA 16 % exclusivo, y el webhook apuntando a
   `https://izixhghxlmsfjwsbohxt.functions.supabase.co/paypal-webhook`.

3. **Secretos de la Edge Function**:

   ```bash
   supabase secrets set PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... \
     PAYPAL_WEBHOOK_ID=... COBRO_ACTIVO=true --project-ref izixhghxlmsfjwsbohxt
   ```

4. **Variables del servidor web** (Vercel, solo servidor): `PAYPAL_CLIENT_ID`,
   `PAYPAL_CLIENT_SECRET` (y `PAYPAL_MODE=sandbox` solo para probar) + redeploy.
5. **Probar en sandbox primero**: repetir 1-4 con una app Sandbox y `PAYPAL_MODE=sandbox`
   en web y función; pagar con una cuenta personal de sandbox y verificar que `subscriptions`
   quede `active` con `payment_provider='paypal'` y `paypal_subscription_id` poblado.

Notas de operación de PayPal:

- Los **veterinarios adicionales** se cobran sobrescribiendo el precio del ciclo por
  suscripción (base + $399/vet al mes o $3,990/vet al año); el plan del catálogo no cambia.
- Si cambia el número de veterinarios de una clínica ya suscrita, el ajuste del monto se hace
  en PayPal (revisar la suscripción) — pendiente de automatizar **[Propuesta]**.
- El fin del periodo se sincroniza con `billing_info.next_billing_time` en cada pago.

## Operación

- **Vigencia** (`clinic_subscription_is_current`): `trialing`/`active` con periodo no vencido,
  o `past_due` con hasta 7 días de tolerancia tras el fin del periodo (reintentos de Stripe).
- **Al vencer**: las escrituras operativas del personal fallan con `SUSCRIPCION_VENCIDA`
  (42501) y el panel queda en solo lectura; la lectura y la administración del equipo siguen.
  El backend (service_role/cron/webhook, sin `auth.uid()`) nunca se bloquea.
- **Reactivar**: el pago por Checkout dispara el webhook, que marca `active` con periodo
  futuro; todo vuelve sin tocar datos. Una corrección manual equivalente (service_role):
  `update subscriptions set status='active', current_period_start=now(),
current_period_end=now()+interval '30 days' where clinic_id = …;`
- **Matiz conocido**: las solicitudes públicas de cita (`request_public_appointment`, anon →
  sin `auth.uid()`) no se bloquean al vencer; el personal simplemente no puede confirmarlas
  hasta reactivar. Si producto quiere ocultar del directorio a las clínicas vencidas, es un
  cambio aparte (filtro en las RPCs públicas).
- **Gracia beta**: la migración dio `current_period_end = now() + 60 días` a las suscripciones
  beta sin fin de periodo. Al vencer esa fecha, la clínica ve el aviso y contrata desde
  `/app/facturacion`.
- **Apagado de emergencia**: `supabase secrets set COBRO_ACTIVO=false` detiene las mutaciones
  del webhook (los eventos se aceptan y solo se registran). Esto NO devuelve el panel a quien
  ya venció: para eso, extender `current_period_end` por service_role.

## Reglas que este flujo respeta

- Sin datos de tarjeta en nuestra base; el checkout es alojado por Stripe.
- `service_role` solo en la Edge Function; la web usa la sesión del usuario (RLS).
- La autorización vive en la base: la UI solo oculta botones (p. ej. a no administradores),
  pero el bloqueo real es el trigger + RLS.
- Dinero en centavos MXN; fechas `timestamptz` UTC.
