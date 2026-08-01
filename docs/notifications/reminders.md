# Recordatorios automáticos (Fase 9)

Modelo y operación del envío programado de recordatorios. Autoridad: las migraciones SQL y
`supabase/functions/send-reminders/`. Decisiones de diseño: [ADR 0003](../adr/0003-recordatorios-programados.md).

## Qué se recuerda

| Recordatorio      | Origen                      | Cuándo se encola                                             | Cuándo se envía                            |
| ----------------- | --------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| Cita (24 h antes) | `appointment_notifications` | al confirmar/reagendar (`enqueue_appointment_notifications`) | `scheduled_start − 24 h`                   |
| Vacuna próxima    | `vaccination_notifications` | al registrar la vacuna (`enqueue_vaccination_reminder`)      | 7 días antes de `next_due_at`, 09:00 local |

Ambos _outbox_ comparten forma: `channel` (`email`/`push`/…), `recipient_email`, `payload`
jsonb **no clínico** (folio, mascota, fechas, clínica), `scheduled_for`, `status`, `attempts`,
`last_error`, `sent_at`, `idempotency_key`.

## Garantías

- **Nada se envía dos veces**: `idempotency_key UNIQUE` por intención (cita+tipo+versión de
  horario / vacuna+tipo). Reencolar la misma intención no crea filas nuevas
  (`on conflict do nothing`). Al reagendar, la clave cambia y la intención previa se cancela.
- **Los fallos se reintentan**: `attempts` se incrementa al reclamar; un fallo con `<5`
  intentos vuelve a `pending`; con `≥5` queda `failed` (terminal y visible).
- **Sin envíos dobles entre procesos**: el reclamo usa `FOR UPDATE SKIP LOCKED`.

## Dos caminos de procesamiento

1. **Panel (bajo demanda, por clínica)** — RPCs `claim_due_appointment_notifications` /
   `claim_due_vaccination_notifications` + `mark_*`, con la sesión del usuario operativo
   (validan `is_clinic_operational_staff`). Nunca `service_role` en `apps/web`.
2. **Backend programado (cross-clínica)** — Edge Function `send-reminders` con `service_role`,
   usando RPCs batch reservadas a `service_role`:
   `claim_due_appointment_notifications_batch(p_limit)`,
   `mark_appointment_notification_by_service(id, ok, error)` y sus equivalentes de vacunación.

## La Edge Function `send-reminders`

- Autenticación: `Authorization: Bearer $CRON_SECRET`.
- Reclama ambos outbox, arma el correo desde `payload` (es-MX, sin datos clínicos), envía por
  Resend (`EMAIL_MODE=resend`) o registra en modo `dev`, y marca el resultado.
- Detalles de invocación, variables y **programación en la nube** (`pg_cron` + `pg_net` con el
  secreto en Supabase Vault, o Vercel Cron): `supabase/functions/send-reminders/README.md`.

## Canal push (cimientos)

`device_tokens` (token FCM por usuario, RLS por dueño) + `register_device_token` /
`unregister_device_token`. La app móvil registrará el token; el envío push a propietarios y la
desparasitación son seguimiento (**[Propuesta]** en ROADMAP).

## Pruebas

`supabase/tests/database/15_recordatorios.sql` (22 aserciones): aislamiento de `device_tokens`,
registro/baja de token, procesamiento batch (service_role sí, `authenticated` no), reintentos
con estado terminal e idempotencia del outbox. Esquemas Zod: `packages/validation` (`devices`).
