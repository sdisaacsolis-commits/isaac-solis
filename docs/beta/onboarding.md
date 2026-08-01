# Runbook de beta — operación con 1–3 clínicas reales

> Guía para poner en marcha y operar la beta de Dogtoralia con clínicas reales.
> Alcance: MVP web. Fecha: 2026-07-29.

## 1. Prerrequisitos

- **Proyecto Supabase** (uno por entorno) con las migraciones de
  `supabase/migrations/` aplicadas y los tipos regenerados (`pnpm db:types`).
- **Variables de entorno** configuradas (ver `.env.example`):
  - Públicas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `NEXT_PUBLIC_APP_URL`.
  - Privadas (servidor/Edge/CI): `SUPABASE_SERVICE_ROLE_KEY` (jamás en el
    cliente), `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
- **Correo transaccional**: cuenta de Resend con dominio verificado. Sin
  `RESEND_API_KEY` el correo corre en modo dev (`EMAIL_MODE=dev`, no envía nada
  real) — útil para pruebas, no para beta con clínicas reales.
- **URLs de redirección de Supabase Auth** dadas de alta según
  `docs/auth/authentication-flow.md`.

## 2. Alta de una clínica beta

1. **Registro**: la persona administradora crea su cuenta en `/registro`
   (nombre, apellidos, correo, contraseña) y confirma su correo.
2. **Onboarding**: al iniciar sesión, el flujo `/app/onboarding` guía la
   creación de:
   - **Organización** (entidad que agrupa clínicas de un mismo dueño).
   - **Clínica** (datos básicos, ciudad; se le asigna automáticamente el plan
     `beta` gratuito por trigger de base de datos).
3. **Invitar personal**: desde `/app/personal`, la administración invita a
   veterinarios y recepción por correo; cada invitación es un enlace con token.
   La persona invitada lo acepta desde `/invitaciones/[token]` (inicia sesión o
   se registra) y queda vinculada a la clínica con su rol.
4. **Configurar servicios**: en `/app/configuracion/servicios`, dar de alta los
   servicios ofrecidos (categoría, precio en centavos MXN, duración).
5. **Configurar horarios**: en `/app/configuracion/horarios`, definir la agenda
   disponible; la restricción anti-traslape se aplica en la base de datos.
6. **Vacunas** (opcional): catálogo en `/app/configuracion/vacunas`.
7. **Visibilidad pública** (opcional): al publicar la clínica aparece en el
   portal público (`/buscar`, `/clinicas/[slug]`) para recibir solicitudes de
   cita en línea.

## 3. Checklist de puesta en marcha

- [ ] Proyecto Supabase con migraciones aplicadas y tipos regenerados.
- [ ] Variables de entorno completas; `service_role` solo en servidor/Edge/CI.
- [ ] Dominio de correo verificado en Resend; envío real probado.
- [ ] URLs de redirección de Auth configuradas.
- [ ] Organización y clínica creadas vía onboarding.
- [ ] Personal invitado y con rol correcto.
- [ ] Servicios y horarios cargados.
- [ ] Prueba de extremo a extremo: solicitar cita → confirmar → cerrar consulta
      → emitir receta → registrar vacunación.
- [ ] Páginas legales revisadas por un abogado y datos entre corchetes «[…]»
      completados (ver `docs/legal/README.md`).
- [ ] Aislamiento verificado: la clínica solo ve sus propios datos.

## 4. Soporte

- Canal de contacto de soporte para las clínicas beta (correo/teléfono a
  definir con el equipo).
- Registro de incidencias y peticiones de mejora para priorizar iteraciones.
- Operaciones sensibles quedan en `audit_log` para diagnóstico.

## 5. Límites conocidos de la beta

- **Recordatorios automáticos**: requieren un cron que dispare las funciones de
  envío y `RESEND_API_KEY` configurado; sin ambos no se envían recordatorios.
  Detalle en `docs/notifications/reminders.md`.
- **Notificaciones push**: requieren la app móvil de propietarios (fase
  posterior); no disponibles solo con la web.
- **Cobros**: las suscripciones existen con plan `beta` gratuito; el cobro real
  con Stripe está en scaffold y **no está activo**. La restricción por plan es
  informativa, no bloqueante.
- **WhatsApp**: integración prevista con Meta WhatsApp Cloud API en fase
  posterior, tras la interfaz de mensajería desacoplada.
- El servicio se ofrece «tal cual» durante la beta (ver `/terminos`).
