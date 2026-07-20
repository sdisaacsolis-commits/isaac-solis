# Flujo de autenticación

> Fase 3. Supabase Auth (correo y contraseña) con `@supabase/ssr`.

## Arquitectura

- **Clientes**: `apps/web/src/lib/supabase/{client,server,middleware}.ts`. Las cookies las
  gestiona el SDK oficial; jamás se guardan tokens en localStorage/sessionStorage ni se
  crean cookies de sesión a mano. La `service_role` no existe en esta app.
- **Middleware** (`src/middleware.ts`): refresca la sesión en cada petición y protege
  `/app/*` en el borde (UX). La protección REAL de datos es RLS; cada página privada
  vuelve a verificar la sesión en el servidor (`requireUser`).
- **Sin Supabase configurado** la app no se rompe: las rutas privadas redirigen a
  iniciar sesión, que muestra el aviso de configuración.

## Rutas

| Ruta                         | Propósito                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `/iniciar-sesion`            | Login. Acepta `?next=` (solo rutas internas, ver anti open-redirect).          |
| `/registro`                  | Alta con nombre, apellidos, correo, contraseña doble y aceptación de términos. |
| `/recuperar-contrasena`      | Solicita el enlace de restablecimiento.                                        |
| `/actualizar-contrasena`     | Fija la nueva contraseña (requiere la sesión del enlace de recuperación).      |
| `/confirmar` (route handler) | Verifica `token_hash`+`type` de los enlaces OTP de Supabase y redirige.        |

Usuarios autenticados que visitan login/registro/recuperar son redirigidos a `/app/inicio`.
`/actualizar-contrasena` queda fuera de esa lista a propósito: el enlace de recuperación
crea sesión y la persona debe poder llegar ahí autenticada.

## Configuración en Supabase (Auth → URL Configuration)

- **Site URL**: `NEXT_PUBLIC_APP_URL`.
- **Redirect URLs**: `{APP_URL}/confirmar` y `{APP_URL}/actualizar-contrasena`.
- **Confirmación de correo**: configurable por entorno. Local
  (`supabase/config.toml → [auth.email] enable_confirmations = false`) permite onboarding
  inmediato; producción la tendrá activada. El código soporta ambos: si `signUp` devuelve
  sesión, va directo al onboarding; si no, muestra “revisa tu correo”.

## Reglas de contraseña

8–72 caracteres (límite bcrypt), al menos una letra y un número
(`passwordSchema` en `packages/validation`). Sin reglas de símbolos arbitrarias.

## Decisiones de seguridad

- **Anti-enumeración**: registro y recuperación responden lo mismo exista o no la cuenta;
  el login responde “Correo o contraseña incorrectos” genérico.
- **Anti open-redirect**: `next` pasa por `safeInternalPathSchema` (solo rutas relativas
  internas); probado en unit tests y con valores manipulados.
- **Headers**: CSP inicial (connect-src limitado a Supabase), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy` (apps/web/next.config.ts). La CSP
  permite `style 'unsafe-inline'` (requisito Next.js) y `'unsafe-eval'` SOLO en desarrollo
  (Fast Refresh); endurecerla con nonces queda para la fase de endurecimiento (Fase 12).
- **CSRF**: las mutaciones son Server Actions de Next (POST con verificación de origen del
  framework) y las cookies de sesión son SameSite=Lax gestionadas por el SDK.
