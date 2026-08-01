# Edge Function: `send-reminders`

Procesador **programado** de recordatorios de Dogtoralia. Reclama y envía las notificaciones
vencidas de los dos outbox del esquema `public` (`appointment_notifications` y
`vaccination_notifications`) de forma cross-clínica, usando la `service_role` de Supabase y las RPCs
`SECURITY DEFINER` reservadas a ese rol (`claim_due_*_notifications_batch`,
`mark_*_notification_by_service`).

Complementa al procesador oportunista del panel web (que corre con la sesión del usuario operativo):
esta función garantiza que los recordatorios salgan aunque nadie tenga el panel abierto.

## Qué hace

1. Autentica la invocación con un secreto compartido (`CRON_SECRET`).
2. Crea un cliente Supabase con `service_role` (`persistSession: false`).
3. Por cada outbox: reclama hasta 50 notificaciones vencidas (`status = 'pending'` y
   `scheduled_for <= now()`, `FOR UPDATE SKIP LOCKED`).
4. Arma un correo en español de México (marca 🐾 Dogtoralia) con datos **operativos, no clínicos**:
   - Citas: mascota, fecha/hora, clínica, folio.
   - Vacunas: mascota, vacuna, próxima fecha, clínica.
5. Envía por correo (Resend en producción; modo dev en cualquier otro caso) y marca el resultado con
   la RPC correspondiente. Un fallo individual deja la notificación reintentable y no rompe el lote.
6. Responde `200` con un resumen JSON:
   ```json
   {
     "ok": true,
     "appointments": { "processed": 3, "sent": 3, "failed": 0 },
     "vaccinations": { "processed": 1, "sent": 1, "failed": 0 }
   }
   ```

## Variables de entorno

| Variable                    | Requerida | Descripción                                                                      |
| --------------------------- | --------- | -------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | Sí        | URL del proyecto Supabase.                                                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí        | Llave `service_role`. **Solo** en Edge Functions/CI, nunca cliente.              |
| `CRON_SECRET`               | Sí        | Secreto compartido con el scheduler. Sin él, la función responde 500.            |
| `EMAIL_MODE`                | No        | `resend` para enviar de verdad; cualquier otro valor → modo dev (default `dev`). |
| `RESEND_API_KEY`            | Solo prod | Token de Resend. Requerido si `EMAIL_MODE=resend`.                               |
| `EMAIL_FROM`                | Solo prod | Remitente. Requerido si `EMAIL_MODE=resend`.                                     |
| `EMAIL_REPLY_TO`            | No        | Dirección de respuesta opcional.                                                 |

> El `CRON_SECRET` y `RESEND_API_KEY` **NUNCA** se commitean: van en el panel de Supabase (Function
> Secrets) o en el Vault, y en CI como secretos del repo.

## Cómo se invoca

`POST` con el secreto en el header `Authorization`:

```bash
curl -X POST "https://<PROJECT_REF>.functions.supabase.co/send-reminders" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Respuestas: `401 {"error":"no autorizado"}` si el secreto falta o no coincide; `500` si el servidor
está mal configurado (falta `CRON_SECRET` o credenciales).

## Cómo se PROGRAMA en la nube

### Opción A — `pg_cron` + `pg_net` + Vault (recomendada)

Guarda el secreto en el Vault de Supabase y agenda una llamada HTTP cada 15 minutos. El secreto se
lee desde `vault.decrypted_secrets`, nunca se escribe en el SQL versionado.

```sql
-- Extensiones (una vez, desde el SQL editor de Supabase):
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Guarda los secretos en el Vault (una vez; reemplaza los valores):
select vault.create_secret('https://<PROJECT_REF>.functions.supabase.co/send-reminders', 'send_reminders_url');
select vault.create_secret('<EL_CRON_SECRET>', 'send_reminders_cron_secret');

-- Agenda cada 15 minutos:
select cron.schedule(
  'send-reminders-cada-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'send_reminders_url'),
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                    where name = 'send_reminders_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Para desagendar: `select cron.unschedule('send-reminders-cada-15-min');`

### Opción B — Vercel Cron o scheduler externo

Cualquier scheduler (Vercel Cron, GitHub Actions programado, cron de un servidor, etc.) puede
golpear el endpoint con el header `Authorization`. El secreto se guarda en el gestor de secretos de
ese scheduler.

Ejemplo de `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "*/15 * * * *" }]
}
```

…donde la ruta hace el `POST` a la Edge Function reenviando `CRON_SECRET` (leído de las env vars del
proyecto, nunca hardcodeado).

## Desarrollo local

```bash
deno check index.ts
deno lint
deno fmt --check
```
