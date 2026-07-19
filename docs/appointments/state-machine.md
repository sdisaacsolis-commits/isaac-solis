# Agenda — Máquina de estados de citas

## Estados (8)

`requested` → solicitada (portal/app/WhatsApp, fase posterior) ·
`pending_confirmation` → pre-agendada, falta confirmación ·
`confirmed` → confirmada · `checked_in` → en recepción ·
`in_progress` → en atención · `completed` ✔ · `cancelled` ✔ · `no_show` ✔
(✔ = terminal).

## Transiciones permitidas

| Desde                           | Hacia                                      |
| ------------------------------- | ------------------------------------------ |
| requested                       | pending_confirmation, confirmed, cancelled |
| pending_confirmation            | confirmed, cancelled                       |
| confirmed                       | checked_in, cancelled, no_show             |
| checked_in                      | in_progress, cancelled                     |
| in_progress                     | completed                                  |
| completed / cancelled / no_show | — (terminales)                             |

## Dónde vive

- **Autoridad**: `appointment_transition_allowed(from, to)` (SQL, immutable) +
  trigger `appointments_enforce_transition` — ni un UPDATE directo puede
  saltarse la máquina.
- **Espejo TS**: `APPOINTMENT_TRANSITIONS` en `@dogtoralia/types`; la UI solo
  muestra acciones válidas, pero la base rechaza cualquier transición inválida.

## Efectos por transición (RPC `transition_appointment_status`)

- Roles: personal operativo (admin/vet/recepción) transiciona; **iniciar y
  completar la atención** exige veterinario o administración (acto clínico).
- `cancelled`: motivo **obligatorio**; sella `cancelled_at/by/reason`, cancela
  recordatorios pendientes y encola aviso de cancelación.
- `no_show`: sella `no_show_at` y cancela recordatorios.
- `completed`: sella `completed_at` y actualiza `clinic_pet_relationships`
  (`last_visit_at`, `first_visit_at` si es primera) **en la misma transacción**.
- `checked_in` / `in_progress`: sellan `checked_in_at` / `started_at`.
- Todo cambio queda en `appointment_status_history` (trigger, append-only, con
  motivo vía GUC transaccional) y en `audit_log`.

## Estados que ocupan agenda

`pending_confirmation`, `confirmed`, `checked_in`, `in_progress` — son el
`WHERE` del `EXCLUDE` anti-traslape (espejo TS:
`OCCUPYING_APPOINTMENT_STATUSES`). `requested` no bloquea el calendario;
los terminales liberan el horario automáticamente.
