# Flujo de onboarding

> Fase 3. `/app/onboarding` — el paso se deriva SIEMPRE del estado real en base de datos,
> nunca de estado local del navegador.

## Pasos

1. **Perfil** — nombre, apellidos, nombre para mostrar, teléfono opcional, zona horaria
   (default `America/Mexico_City`). Actualiza `profiles` (creado automáticamente por el
   trigger de `auth.users` de la Fase 2). Esquema: `onboardingProfileSchema`.
2. **Organización** — nombre comercial, razón social/RFC/slug opcionales. Se crea con la
   RPC **`create_organization_with_owner`** (organización + membresía `owner` en una
   transacción). Sin inserts directos. Errores mapeados: slug reservado/ocupado.
3. **Primera clínica** — nombre y datos de contacto/dirección (CP de 5 dígitos, zona
   horaria; moneda MXN y país MX fijos en esta fase). Se crea con la RPC
   **`create_clinic_with_admin`** (migración 0012): clínica en `trial` + membresía
   `clinic_admin` del creador, atómico. Al terminar fija la clínica activa y entra al
   dashboard.

## Redirecciones

- Usuario autenticado sin organización activa → toda página privada lo manda a
  `/app/onboarding` (`requireTenancyContext`).
- Onboarding completo → `/app/onboarding` redirige a `/app/inicio`.
- Con perfil ya completo el flujo entra directo al paso pendiente (reanudable).

## Contexto activo (organización/clínica)

- Organización activa: la membresía activa más antigua (multi-organización llegará con un
  selector; el modelo ya lo soporta).
- Clínica activa: cookie `dt_clinica_activa` **validada contra RLS** en cada carga — si la
  cookie apunta a una clínica no visible, se ignora y se usa la primera visible. Los IDs
  del navegador jamás se usan sin pasar por RLS.

## Auditoría

Organización, membresías y clínica creadas quedan en `audit_log` automáticamente
(triggers de la Fase 2). El inicio del onboarding no genera evento propio: el primer
evento de negocio auditado es la creación de la organización.
