# Portal público — Modelo y seguridad (Fase 8)

Réplica funcional del marketplace de referencia (docs/product/doctoralia-audit.md) con
implementación y marca propias.

## Principio de seguridad

**El sitio público y el portal del propietario JAMÁS leen tablas base**: toda la
superficie es RPC `SECURITY DEFINER` con campos curados. `anon` no tiene grants sobre
ninguna tabla (probado: 42501). Lo público expone SOLO clínicas con `is_public = true`
operativas (`clinic_is_publicly_visible`), y la reservación exige además
`accepts_online_booking` — ambos son opt-in de cada clínica desde el panel.

## Entidades nuevas

| Tabla                          | Propósito                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `veterinarian_public_profiles` | Perfil público OPT-IN por usuario veterinario (slug global único, valida rol activo y slugs reservados; cada quien edita solo el suyo) |
| `portal_invitations`           | Invitación al portal del propietario: token hasheado SHA-256 (ilegible para clientes), expira en 7 días, un solo uso                   |
| `public_booking_requests`      | Rastro auditable e idempotencia de las solicitudes públicas (única por clínica+request_id)                                             |

## Superficie pública (anon + authenticated)

`search_public_clinics` (q/ciudad/categoría, paginada, máx 50), `get_public_clinic`
(servicios activos + equipo veterinario con cédula + slug de perfil), `get_public_veterinarian`,
`list_public_cities`, `get_public_available_slots` y `request_public_appointment`.

`get_available_slots` se re-emitió (la migración original es inmutable) con UNA extensión:
el GUC transaccional `app.portal_public_slots`, que SOLO fijan las funciones públicas tras
validar que la clínica es públicamente reservable. Para el personal nada cambia.

## Portal del propietario (authenticated)

`get_my_pets`, `get_my_appointments`, `get_my_pet_history` (curado: consultas finalizadas
con motivo, recetas emitidas con partidas, vacunas con fuente — **jamás** notas internas,
SOAP ni exploración) y `cancel_my_appointment` (solo citas propias futuras, hasta 2 h
antes; aviso por el outbox). La vinculación cuenta↔propietario es SIEMPRE por invitación
explícita de la clínica (`create_portal_invitation`/`accept_portal_invitation`), nunca por
coincidencia de correo (regla de Fase 4).
