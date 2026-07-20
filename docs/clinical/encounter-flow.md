# Flujo de una consulta

## Estados

`in_progress → finalized → voided` (y `in_progress → voided`). La autoridad es
`encounter_transition_allowed` en SQL; TS solo la refleja (`ENCOUNTER_TRANSITIONS`).

- **`in_progress`**: la consulta abierta ES el borrador (decisión: no existe un estado
  `draft` separado). Todo el contenido se captura aquí.
- **`finalized`**: inmutable; solo adendas. Completa la cita vinculada si estaba en atención.
- **`voided`**: anulación administrativa (ver `finalization-and-addenda.md`).

## Apertura

1. **Desde cita** — `start_encounter_from_appointment(p_appointment_id)`: acepta citas
   `confirmed`/`checked_in`/`in_progress` (encadena las transiciones legales de agenda,
   que exigen veterinario o administración para iniciar la atención). Es **idempotente**:
   doble clic o concurrencia devuelven la consulta existente (índice único parcial).
2. **Walk-in/urgencia** — `create_walk_in_encounter(...)`: crea la **cita interna**
   (`source='walk_in'`, sin validar horario laboral; queda auditada) con
   `book_appointment` y abre la consulta de inmediato con tipo `walk_in` o `emergency`.

## Folio

`CON-AAAA-NNNNNN` por clínica y año, generado con contador UPSERT
(`clinical_folio_counters`, `next_clinical_folio`) seguro ante concurrencia; nunca se
reutiliza, ni siquiera al anular.
