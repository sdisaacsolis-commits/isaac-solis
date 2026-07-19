# Agenda — Notificaciones (outbox)

## Por qué un outbox

El envío directo dentro de la transacción de reserva acoplaría el dominio al
proveedor y produciría o citas sin registrar (si el envío falla) o correos
duplicados (si la transacción se reintenta). El **outbox**
(`appointment_notifications`) registra la _intención_ en la misma transacción
que crea/modifica la cita, y un procesador la envía después con reintentos,
idempotencia y trazabilidad.

## Qué se encola (RPCs, misma transacción)

| Evento                         | Notificaciones                                                           |
| ------------------------------ | ------------------------------------------------------------------------ |
| Reserva confirmada             | `confirmation` + `reminder_24h`/`reminder_2h` si aún son futuros         |
| Confirmación de una solicitada | `confirmation` + recordatorios                                           |
| Reagendamiento                 | recordatorios previos → `cancelled`; `reschedule` + recordatorios nuevos |
| Cancelación                    | recordatorios → `cancelled`; `cancellation`                              |
| No-show                        | recordatorios → `cancelled`                                              |

- **Idempotencia**: `idempotency_key = citaId:epoch(horario):tipo` con
  `UNIQUE`; reintentos de RPC o del procesador no duplican envíos.
- **Payload NO clínico**: folio, nombres, fechas, clínica. Jamás diagnósticos.
- Sin correo del propietario no se encola (el panel siempre muestra la cita).
- Canales: `email` (activo), `whatsapp`/`push`/`sms` **preparados** detrás de
  la interfaz de proveedor (ARCHITECTURE.md §6.1; WhatsApp: Meta Cloud API en
  fase posterior).

## Procesamiento (sin cron externo)

1. `claim_due_appointment_notifications(clinic, limit)` — DEFINER, exige
   personal operativo, `FOR UPDATE SKIP LOCKED` (sin dobles envíos), marca
   `processing`.
2. El panel (`procesarNotificacionesDeClinica`) arma el correo
   (`armarCorreoCita`) y lo envía por la interfaz `EmailProvider`
   (Resend real o adaptador dev que no envía).
3. `mark_appointment_notification(id, ok, error)` — `sent` o reintento
   (`pending` hasta 5 intentos, luego `failed` visible en el detalle).

El procesamiento es **oportunista**: corre tras cada acción de agenda con la
sesión del usuario (nunca `service_role` en `apps/web`). Los correos
inmediatos salen al momento; los recordatorios vencidos salen en cuanto el
personal opera el panel.

## Procesador programado (preparado, fase posterior)

Para independencia total del panel: una **Edge Function** con `service_role`
invocada por cron (Supabase Cron / proveedor externo) que llame a las mismas
RPCs por clínica. `CRON_SECRET` (`.env.example`) queda reservada para
autenticar ese disparador. No se implementa en esta fase para no depender de
infraestructura externa al CI.
