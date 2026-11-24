-- ============================================================================
-- Fase 14 — PayPal como segundo proveedor de pagos
-- ============================================================================
-- Decisión de producto (24-nov-2026): además de Stripe (tarjetas), la membresía
-- puede pagarse con PayPal (cuenta Business de AniMALL). El modelo de planes,
-- prueba, vigencia y solo lectura (Fase 13) es agnóstico del proveedor; aquí
-- solo se generaliza la vinculación: cada suscripción registra con qué
-- proveedor se cobra y el identificador de la suscripción en ese proveedor.
-- Los webhooks (stripe-webhook / paypal-webhook, service_role) siguen siendo
-- la única pluma sobre `subscriptions`; ningún dato de pago toca nuestra base.
-- ============================================================================

alter table public.subscriptions
  add column payment_provider text
    constraint subscriptions_payment_provider_valido
    check (payment_provider in ('stripe', 'paypal')),
  add column paypal_subscription_id text;

comment on column public.subscriptions.payment_provider is
  'Proveedor que cobra esta suscripción (stripe|paypal); null hasta el primer checkout.';
comment on column public.subscriptions.paypal_subscription_id is
  'Identificador de la suscripción en PayPal (I-…); lo escribe el webhook.';

-- Una suscripción de PayPal pertenece a una sola clínica (igual criterio que
-- permitiría indexar la de Stripe; parcial para ignorar los null).
create unique index subscriptions_paypal_subscription_id_key
  on public.subscriptions (paypal_subscription_id)
  where paypal_subscription_id is not null;

-- Las suscripciones ya vinculadas a Stripe quedan etiquetadas (idempotente).
update public.subscriptions
set payment_provider = 'stripe'
where stripe_subscription_id is not null
  and payment_provider is null;
