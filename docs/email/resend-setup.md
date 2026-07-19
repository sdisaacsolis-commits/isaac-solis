# Correo transaccional con Resend

> Fase 3. Interfaz desacoplada (ARCHITECTURE.md §6.1): el dominio solo conoce
> `EmailProvider`; Resend es un adaptador reemplazable.

## Arquitectura

```
lib/email/types.ts            → contrato EmailProvider / InvitationEmailInput
lib/email/resend-provider.ts  → adaptador Resend (API REST, sin SDK)
lib/email/dev-provider.ts     → adaptador de desarrollo (no envía; log redactado)
lib/email/template-invitacion.ts → asunto + HTML + texto plano (es-MX)
lib/email/index.ts            → selección por configuración
```

Decisión (ADR 0002): en esta fase el envío corre en **Server Actions de Next**, no en una
Edge Function. Motivo: el token de invitación existe una sola vez dentro de la acción que
lo genera; enviarlo desde la misma transacción de trabajo evita pasarlo por otro servicio.
Las Edge Functions llegan con los recordatorios (Fase 9), donde el disparador es un cron y
no una acción de usuario.

## Configuración

| Variable         | Tipo    | Uso                                                           |
| ---------------- | ------- | ------------------------------------------------------------- |
| `EMAIL_MODE`     | privada | `dev` (default: no envía, registra redactado) o `resend`      |
| `RESEND_API_KEY` | privada | API key (solo con `EMAIL_MODE=resend`)                        |
| `EMAIL_FROM`     | privada | Remitente, p. ej. `Dogtoralia <notificaciones@dogtoralia.mx>` |
| `EMAIL_REPLY_TO` | privada | Respuesta, p. ej. `soporte@dogtoralia.mx`                     |

Sin configuración completa la app cae automáticamente al adaptador dev: el onboarding y
las invitaciones NUNCA se rompen por falta de correo; la UI informa que el correo no se
envió y ofrece reenviar.

## DNS pendiente (cuando exista el dominio definitivo)

En Resend: alta del dominio + registros **SPF**, **DKIM** y **DMARC** que el panel
indique, y verificación del remitente. Mientras tanto los valores de `.env.example` son
ejemplos y `EMAIL_MODE=dev`.

## Reglas de manejo del token en correo

- El enlace completo solo existe en el cuerpo del correo y en memoria del servidor.
- Logs operativos: el token se redacta a `…xxxx` (últimos 4) — probado en unit tests.
- El adaptador de Resend jamás incluye el cuerpo del correo en errores.

## Plantilla

Asunto: `Invitación para unirte a {clínica} en Dogtoralia`. HTML sencillo sin imágenes
remotas ni rastreadores + alternativa de texto plano; incluye clínica, rol, botón de
aceptación, enlace textual y fecha de vencimiento en es-MX (America/Mexico_City).
