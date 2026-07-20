# Pruebas E2E de autenticación

> Fase 3. Playwright (`apps/web/e2e/`). Sin dependencias de servicios externos reales.

## Suites

| Archivo               | Requiere Supabase     | Qué cubre                                                                                                                                                                            |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inicio.spec.ts`      | No                    | Portada, idioma es-MX, accesos a login/registro                                                                                                                                      |
| `auth-rutas.spec.ts`  | No                    | Bloqueo de TODAS las rutas privadas sin sesión, render de formularios de login/registro/recuperación, enlaces de invitación malformados y válidos sin sesión (con `next` preservado) |
| `auth-flujos.spec.ts` | **Sí** (`E2E_AUTH=1`) | Registro → onboarding completo → dashboard con datos reales; creación de invitación + reenviar/revocar visibles; segunda sesión sin acceso; recuperación con mensaje neutro          |

## Ejecutar

```bash
# Básicas (CI las corre siempre; no necesitan Supabase)
pnpm test:e2e

# Flujos completos contra Supabase local
pnpm db:start           # confirmación de correo deshabilitada en config local
E2E_AUTH=1 pnpm test:e2e

# En sandboxes con Chromium preinstalado
PLAYWRIGHT_CHROMIUM_PATH=/ruta/a/chromium pnpm test:e2e
```

Los datos de `auth-flujos` son desechables (correos `e2e.*.{timestamp}@ejemplo.mx`) y el
envío de correo corre en modo dev (sin proveedor real).

## Qué NO cubre E2E (y dónde se cubre)

La aceptación real del token de invitación, su vencimiento, revocación y unicidad se
prueban en pgTAP (suites 05 y 06): el token solo existe dentro de la RPC y el correo, y
extraerlo en E2E obligaría a exponerlo. La cadena UI de aceptación (página de invitación
→ login → aceptar) se cubre con las pruebas de rutas + pgTAP de la RPC.
