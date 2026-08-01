# ADR 0003 — Procesador programado de recordatorios (Fase 9)

- **Fecha**: 2026-07-29
- **Estado**: aceptada

## Contexto

Las Fases 5 y 7 ya construyeron los _outbox_ de notificaciones (`appointment_notifications`,
`vaccination_notifications`) con encolado idempotente (`idempotency_key UNIQUE`), reintentos
(`attempts`, tope 5) y reclamo `FOR UPDATE SKIP LOCKED`. El panel los procesa con la sesión
del usuario operativo (RPCs `claim_due_*` por clínica; jamás `service_role` en `apps/web`,
CLAUDE.md §2). Faltaba el disparador **programado** que envíe los recordatorios (cita 24 h
antes, vacuna próxima) sin depender de que alguien abra el panel. `CRON_SECRET` estaba
definido en el entorno pero sin consumidor.

## Decisiones

1. **El procesador programado es una Edge Function (`send-reminders`), no una Server Action.**
   Debe correr sin usuario y leer/escribir el outbox de **todas** las clínicas, lo que exige
   `service_role`; y `service_role` está prohibido en `apps/web` (CLAUDE.md §2). Por eso vive
   en Deno (`supabase/functions/send-reminders/`), el único lugar permitido junto con CI. El
   procesamiento _en el panel_ (bajo demanda, por clínica, con la sesión del usuario) se
   conserva: son dos caminos que comparten las mismas tablas.

2. **RPCs batch cross-clínica reservadas a `service_role`.** Se añaden
   `claim_due_appointment_notifications_batch` / `mark_appointment_notification_by_service`
   (y las equivalentes de vacunación): reclaman las notificaciones vencidas de todas las
   clínicas y aplican los reintentos, con `grant execute` exclusivo a `service_role`
   (revocado a `anon`/`authenticated`). Las RPCs por clínica del panel no cambian.

3. **La programación (cron) se configura en la nube, no en una migración.** La URL de la
   función y `CRON_SECRET` son específicos del entorno y el secreto nunca se commitea; además
   `pg_cron`/`pg_net` no están en el runner de pruebas sin Docker ni garantizados en CI.
   La programación se documenta como snippet SQL a ejecutar una vez en la nube (`pg_cron` +
   `pg_net` leyendo el secreto de **Supabase Vault**), con alternativa de un scheduler externo
   (Vercel Cron) que golpea el endpoint con `Authorization: Bearer $CRON_SECRET`. Ver
   `supabase/functions/send-reminders/README.md`.

4. **Idempotencia y reintentos siguen siendo responsabilidad de la BD.** «Nada se envía dos
   veces» lo garantiza `idempotency_key UNIQUE`; «los fallos se reintentan» lo garantiza el
   contador `attempts` con estado terminal `failed` tras 5 intentos. La Edge Function solo
   orquesta: reclama, arma el correo desde el `payload` (nunca datos clínicos), envía por el
   proveedor y marca el resultado.

5. **Canal push: solo cimientos en esta fase.** Se crea `device_tokens` (registro de tokens
   FCM por usuario, RLS por dueño) y la RPC `register_device_token`, que consumirá la app
   móvil (fase posterior). El envío push a propietarios (mapear propietario → usuario → tokens)
   y la desparasitación (`dewormings`, sin tabla base) quedan como **[Propuesta]** de
   seguimiento en el ROADMAP: exceden el alcance verificable de la Fase 9.

## Consecuencias

- El envío real de correo depende de `EMAIL_MODE=resend` + `RESEND_API_KEY`; en `dev` la
  función registra (redactado) y marca como enviado para no reintentar, igual que el panel.
- CI gana un job **«Edge Functions (Deno)»** (`deno fmt --check`, `deno lint`, `deno check`)
  que verifica la función; el resto de jobs no cambia.
- El proveedor de correo se reimplementa en Deno (thin `fetch` a Resend): la interfaz
  `EmailProvider` de `apps/web` no es importable desde Deno, pero el contrato conceptual
  (ARCHITECTURE.md §6.1) se respeta.
