# Portal público — Pruebas (Fase 8)

## pgTAP (suite 13, 33 aserciones; 474 totales)

RLS forzado en las 3 tablas nuevas; perfil público solo para veterinarios activos y solo
propio (0 filas ajenas); slugs reservados rechazados; anon ve SOLO clínicas `is_public`
(B invisible) y JAMÁS tablas base (42501); huecos reales visibles vía wrapper y negados
sin `accepts_online_booking`; solicitud de invitado con folio real, idempotente, con
límite 5/24h, horario inexistente rechazado (`HORARIO_NO_DISPONIBLE`) y clínica privada
rechazada; el personal ve solicitudes solo de SU clínica; invitación al portal con token
64-hex de un solo uso; vinculación explícita (user_id + can_access_portal); lecturas
curadas del portal (mascotas/citas/historial con secciones permitidas, mascota ajena
42501, usuario sin vínculo ve vacío); cancelación en línea solo de citas propias.

## Unitarias (Vitest)

`packages/validation/src/schemas/portal.test.ts`: reserva de invitado (correo/teléfono/
idempotency key/slug manipulado), perfil público (slug normalizado), token de invitación,
búsqueda con paginación por defecto. 171 totales.

## E2E (Playwright)

Rutas públicas accesibles sin sesión y `/mi` protegido; flujo completo con Supabase real
en CI: reservar como invitado desde el perfil público → la clínica confirma → invitar al
propietario al portal → aceptar → ver mascotas/citas/historial → cancelar en línea.
