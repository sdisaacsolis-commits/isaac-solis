# Agenda — Modelo de dominio (Fase 5)

## Entidades

| Tabla                          | Propósito                                                                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clinic_services`              | Catálogo por clínica: categoría (9), duración, colchones, precio en **centavos MXN**. Se desactiva, no se borra.                                                                          |
| `clinic_service_veterinarians` | Qué veterinarios prestan cada servicio (asignación explícita; trigger exige rol `veterinarian` activo de la misma clínica).                                                               |
| `veterinarian_schedules`       | Ventanas semanales por profesional (weekday ISO 1–7, hora **local de la clínica**), con vigencia opcional y `EXCLUDE` anti-traslape.                                                      |
| `schedule_exceptions`          | Bloquean disponibilidad (vacaciones, incapacidad, permiso, capacitación, festivo, cierre de clínica, otra) o la **agregan** (`special_hours`). `clinic_member_id` nulo = toda la clínica. |
| `appointments`                 | La cita: folio, paciente, propietario, profesional, ventana visible (`scheduled_*`) y ventana **ocupada** (`occupies_*`, incluye colchones), estado, origen, urgencia, hitos.             |
| `appointment_services`         | Servicios de la cita con **snapshot** de nombre/duración/precio al agendar.                                                                                                               |
| `appointment_status_history`   | Historial de estados **append-only**, poblado por trigger.                                                                                                                                |
| `appointment_folio_counters`   | Contadores de folio por clínica y año (solo funciones DEFINER).                                                                                                                           |
| `appointment_notifications`    | Outbox de notificaciones (ver `notifications.md`).                                                                                                                                        |

## Decisiones

- **Sin tabla `veterinarian_profiles` separada**: los datos profesionales viven en
  `clinic_members` (rol `veterinarian`); la agenda referencia `clinic_member_id`.
  Una tabla aparte duplicaría membresía/estado sin aportar invariantes nuevos.
  Si la Fase 6+ necesita cédula/especialidades, se agregan columnas o una tabla
  1:1 **[Propuesta]**.
- **La cita ancla a un `clinic_member_id`**, no a un `user_id`: si la persona
  deja la clínica, el registro histórico de la membresía se conserva
  (`deleted_at`), y la cita sigue apuntando a quien atendió.
- Las citas **nunca se borran** (`on delete restrict` desde mascota/propietario):
  cancelación y no-show son estados terminales.
- `organization_id` + `clinic_id` en todas las tablas de agenda: aislamiento por
  RLS y contexto de auditoría (mismo patrón de la Fase 4).

## Diagrama (texto)

```
clinics ─┬─ clinic_services ─── clinic_service_veterinarians ── clinic_members(vet)
         ├─ veterinarian_schedules ──────────────────────────── clinic_members(vet)
         ├─ schedule_exceptions (opcional clinic_member_id)
         └─ appointments ─┬─ appointment_services (snapshot de clinic_services)
                          ├─ appointment_status_history (trigger, append-only)
                          └─ appointment_notifications (outbox)
appointments → pets / pet_owners (relaciones activas validadas por trigger)
```
