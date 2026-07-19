# Agenda de citas (Fase 5)

Servicios veterinarios, disponibilidad profesional y agenda con anti-traslape
garantizado por la base de datos.

## Documentos

1. [domain-model.md](./domain-model.md) — entidades y decisiones de modelado.
2. [scheduling-and-availability.md](./scheduling-and-availability.md) — horarios, excepciones y cálculo de slots.
3. [state-machine.md](./state-machine.md) — estados, transiciones y efectos.
4. [folios.md](./folios.md) — folio secuencial por clínica/año, concurrencia-seguro.
5. [notifications.md](./notifications.md) — outbox, idempotencia y recordatorios 24h/2h.
6. [rls-and-permissions.md](./rls-and-permissions.md) — RLS y matriz de roles.
7. [walk-ins-and-emergencies.md](./walk-ins-and-emergencies.md) — llegadas sin cita y urgencias.
8. [ui-flows.md](./ui-flows.md) — rutas y principios de la interfaz.
9. [testing.md](./testing.md) — pgTAP, unitarias y E2E. · [error-codes.md](./error-codes.md) — códigos de dominio.

## Garantías clave (resumen)

- **Anti-traslape**: `EXCLUDE USING gist (vet =, tstzrange(occupies) &&)` solo
  sobre estados que ocupan agenda; los colchones del servicio forman parte del
  rango ocupado. Imposible de eludir desde la aplicación.
- **Escrituras solo por RPC**: los clientes no tienen INSERT/UPDATE sobre
  citas, horarios ni historial; la máquina de estados y los folios viven en la
  base.
- **Zona horaria**: UTC en almacenamiento; presentación y captura en la zona
  IANA de la clínica.
- **Dinero**: centavos MXN (enteros) con snapshot por cita.

## Rendimiento e índices

- `appointments`: (clinic, scheduled_start), (vet, scheduled_start),
  (clinic, status), pet, owner — cubren agenda por día/semana, columnas por
  profesional y filtros de estado. El índice GiST del EXCLUDE sirve además a
  las consultas de traslape de disponibilidad.
- `veterinarian_schedules` (member, weekday, parcial `active`) y
  `schedule_exceptions` (clinic/member + starts_at) mantienen el cálculo de
  slots en rangos acotados (máximo 31 días por consulta).
- `appointment_notifications` parcial sobre `status='pending'`
  (scheduled_for): el claim del outbox no recorre historial enviado.
- Listados de UI limitados (500 citas por rango, 100 excepciones) y conteos
  del dashboard con `head: true` (sin transferir filas).
