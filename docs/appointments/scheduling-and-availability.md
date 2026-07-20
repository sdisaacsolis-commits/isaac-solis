# Agenda — Horarios y disponibilidad

## Horario semanal

- Ventanas por profesional: `weekday` ISO (1=lunes … 7=domingo), `start_time` /
  `end_time` en **hora local de la clínica** (`clinics.timezone`, IANA).
- Vigencia opcional (`effective_from` / `effective_until`) para cambios de
  temporada sin tocar el histórico.
- Anti-traslape en la base: `EXCLUDE USING gist` sobre
  (profesional, día, rango de minutos, rango de vigencia) — dos ventanas del
  mismo día no pueden cruzarse mientras estén activas.
- `configure_veterinarian_schedule(clinic, member, slots)` reemplaza el horario
  de forma transaccional: desactiva las ventanas vigentes (queda rastro en
  auditoría) e inserta las nuevas.

## Excepciones

- Tipos bloqueantes: `vacation`, `sick_leave`, `personal`, `training`,
  `holiday`, `clinic_closure` (siempre a toda la clínica), `other`.
- `special_hours` **agrega** disponibilidad fuera del horario base y siempre
  pertenece a una persona concreta.
- Un veterinario puede registrar sus propias excepciones; administración las
  gestiona todas (RLS).

## Cálculo de slots — `get_available_slots`

`get_available_slots(clinic, member, service, from_date, to_date)`:

1. Solo miembros de la clínica (42501 en caso contrario); rango máximo **31 días**.
2. Por cada día: ventanas del horario vigente + ventanas `special_hours`.
3. Rejilla de **15 minutos**; el servicio debe caber completo en la ventana.
4. Se descarta el slot si su **ventana ocupada** (visible + colchones del
   servicio) cruza una excepción bloqueante o una cita en estado que ocupa
   agenda — exactamente la misma regla que el `EXCLUDE` de citas, por lo que
   un slot ofrecido no puede fallar después por traslape (salvo carrera con
   otra reserva simultánea, que el `EXCLUDE` sí rechaza).
5. Slots en el pasado no se ofrecen.

## Zonas horarias

Regla del producto: **almacenar UTC, presentar en la zona de la clínica**.
Los formularios capturan hora local (datetime-local / time); las Server
Actions convierten con `localAUtc` (Intl, doble pasada, sin dependencias) y
las RPCs trabajan solo con `timestamptz`.
