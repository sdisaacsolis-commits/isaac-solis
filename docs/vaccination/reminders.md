# Vacunación — Recordatorios (outbox)

Reutiliza la arquitectura de outbox de la agenda (docs/appointments/notifications.md): la
**intención** de notificar se inserta en `vaccination_notifications` en la **misma
transacción** que el registro; el envío ocurre después, nunca dentro de la transacción
clínica.

## Encolado (`enqueue_vaccination_reminder`, interna)

- Solo si el registro está `recorded` y tiene `next_due_at` **confirmada por el
  veterinario**.
- Destinatario: propietario principal activo **con correo** (sin correo no hay canal en
  esta fase; el panel siempre muestra las próximas dosis).
- Programación: aviso **7 días antes** de la fecha objetivo (09:00 hora local de la
  clínica); si ya estamos dentro de la ventana, inmediato; si la fecha ya pasó, no se
  genera recordatorio extemporáneo.
- **Idempotencia**: clave `{record_id}:{epoch_fecha_objetivo}:next_dose_due` con `ON
CONFLICT DO NOTHING` — reintentos y dobles envíos no duplican.
- Payload **operativo mínimo**: mascota, nombre de la vacuna, fecha, clínica y zona
  horaria. Sin lote, sin enfermedades, sin contenido clínico sensible.

## Cancelación y corrección

- `void_vaccination_record` **cancela** los recordatorios pendientes del registro.
- Un registro correctivo nuevo (tras anular) encola su propio recordatorio con clave
  propia — reprogramación sin duplicados.

## Procesamiento

Mismo patrón que la agenda: `claim_due_vaccination_notifications(clinic, limit)` con
`FOR UPDATE SKIP LOCKED` (sin dobles envíos entre pestañas/procesos) y
`mark_vaccination_notification(id, ok, error)` con reintentos limitados (5 → `failed`).
El panel procesa oportunistamente con la sesión del usuario operativo (jamás service_role
en `apps/web`); el procesador programado con `CRON_SECRET` (Edge Function + cron) queda
para la fase de recordatorios automáticos (ROADMAP Fase 9).

**Canal**: correo únicamente (proveedor desacoplado `EmailProvider`, modo `dev` sin envío
real). WhatsApp y push llegan en fases posteriores tras la interfaz desacoplada
(ARCHITECTURE.md §6.1).

## Eventos cubiertos

- `next_dose_due`: próxima vacuna/refuerzo confirmado.
- Anulación de registro → cancelación del recordatorio (no se notifica al propietario en
  esta fase; decisión conservadora para no enviar correos administrativos innecesarios).
