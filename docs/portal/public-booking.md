# Portal público — Reservación en línea de invitado

Como el referente: se reserva **sin cuenta previa**. Flujo (`request_public_appointment`):

1. Clínica por slug: debe ser pública y con `accepts_online_booking`
   (`RESERVACION_NO_DISPONIBLE`).
2. **Idempotencia**: `request_id` del formulario; el doble envío devuelve la MISMA
   solicitud (folio incluido).
3. Datos mínimos validados (nombre, apellidos, correo válido, teléfono E.164 opcional,
   mascota+especie); anti-abuso: máximo **5 solicitudes por correo y clínica en 24 h**
   (`SOLICITUDES_EXCEDIDAS`).
4. Servicio activo de la clínica y veterinario asignado a ese servicio.
5. El horario debe ser un **hueco real vigente** (`get_available_slots`;
   `HORARIO_NO_DISPONIBLE` si ya no lo es).
6. Se crean propietario y mascota MÍNIMOS **sin verificar** (fuente
   `owner_registration`) — la clínica los depura al confirmar; la detección de duplicados
   de Fase 4 aplica.
7. La cita nace `requested` con fuente `owner_portal` y folio real `CIT-`:
   **NO ocupa agenda** (el EXCLUDE de Fase 5 solo cubre estados ocupantes) hasta que la
   clínica la pase a confirmada desde el panel — las carreras se resuelven en la
   confirmación, que sí compite por el EXCLUDE.
8. Rastro en `public_booking_requests` + `audit_log` (redactado).

El aviso al invitado sale por el outbox cuando la clínica confirma o cancela (flujo de
notificaciones de Fase 5). El propietario puede cancelar en línea su cita
(`cancel_my_appointment`) hasta 2 h antes; después, por teléfono (`PLAZO_EXCEDIDO`).
