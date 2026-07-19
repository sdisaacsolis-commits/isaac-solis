# ADR 0002 — Autenticación, formularios y correo (Fase 3)

- **Fecha**: 2026-07-19
- **Estado**: aceptada

## Contexto

La Fase 3 implementa autenticación, onboarding e invitaciones sobre el esquema RLS de la
Fase 2. Varias decisiones merecen registro.

## Decisiones

1. **@supabase/ssr con cookies del SDK** — nada de tokens en localStorage ni cookies
   manuales; middleware oficial de refresco + verificación en servidor por página.
2. **Formularios con Server Actions + useActionState, sin React Hook Form.** La validación
   autoritativa es Zod en el servidor (esquemas compartidos de `packages/validation`); el
   cliente solo muestra errores por campo. Evita duplicar reglas en el navegador y una
   dependencia; RHF se reevaluará si aparecen formularios de alta interactividad (agenda).
3. **Correo desde Server Actions, no Edge Function (por ahora).** El token de invitación
   existe una única vez dentro de la acción que lo genera; enviarlo ahí evita transferirlo
   a otro servicio. Edge Functions llegan con los recordatorios (Fase 9). El contrato
   `EmailProvider` mantiene el desacoplamiento exigido por ARCHITECTURE.md §6.1.
4. **Reenvío de invitación = reemplazo de token in situ** (`resend_clinic_invitation`):
   invalida el enlace anterior al instante sin crear filas duplicadas ni tocar la
   restricción de pendientes únicas.
5. **Visibilidad de colegas vía vista segura** (`colleague_profiles`) en lugar de política
   sobre `profiles`: restringe columnas (sin teléfono ni banderas) y filtro (organización
   compartida activa) en un objeto auditable único.
6. **Selección de organización activa**: la membresía activa más antigua; multi-organización
   tendrá selector propio. Clínica activa: cookie de preferencia SIEMPRE validada contra
   RLS antes de usarse.
7. **E2E en dos niveles**: suites sin Supabase (protección de rutas, formularios) corren
   siempre; flujos completos requieren `E2E_AUTH=1` + Supabase local. La aceptación del
   token se prueba en pgTAP, no en E2E, para no exponer tokens.

## Consecuencias

- `apps/web` depende solo de `@supabase/supabase-js`, `@supabase/ssr` y `server-only`
  como novedades de runtime.
- Los mensajes de validación viven una sola vez (Zod es-MX) y la UI los muestra tal cual.
- Cuando exista dominio definitivo, activar `EMAIL_MODE=resend` es solo configuración.
