# Vacunación — Flujo de aplicación en clínica

`record_vaccination(...)` — RPC transaccional, solo **veterinarios activos** de la clínica.

1. Verifica clínica activa, veterinario (`PERMISO_DENEGADO`) y relación clínica–mascota
   vigente (`MASCOTA_SIN_RELACION`).
2. **Idempotencia**: si `client_request_id` ya existe en la clínica, devuelve el registro
   existente (el doble clic o el reintento de red no duplican aplicaciones). La carrera
   exacta se resuelve con el índice único parcial + manejo de `unique_violation`.
3. Producto: del **catálogo** de la organización (activo) o **nombre capturado**
   (`VACUNA_REQUERIDA` si falta ambos). El snapshot toma el catálogo como base y la
   captura explícita prevalece.
4. **Lote**: obligatorio o justificación documentada (`LOTE_REQUERIDO`); con lote, la
   **caducidad** es obligatoria (`CADUCIDAD_REQUERIDA`); un producto caducado se rechaza
   (`PRODUCTO_CADUCADO`). Ver `lots-and-expiration.md`.
5. `administered_at = now()` — **hora del servidor**, siempre. Las fechas históricas solo
   entran por el flujo de registros históricos (`historical-records.md`).
6. **Próxima dosis** (`next_due_at`): opcional, debe ser futura (`FECHA_INVALIDA`) y la
   confirma el veterinario. Si el producto del catálogo tiene
   `default_booster_interval_days`, la UI solo **pre-llena un campo editable** marcado como
   sugerencia; nada se agenda sin confirmación explícita.
7. Consulta opcional (`encounter_id`): debe pertenecer a la misma clínica y mascota y no
   estar anulada; se acepta abierta o finalizada (la aplicación ocurre durante la
   atención). Decisión documentada.
8. En la **misma transacción**: registro inmutable + historial (trigger) + **comprobante
   congelado** con SHA-256 (`vaccination_documents`) + recordatorio en el outbox si hay
   próxima dosis (ver `reminders.md`) + auditoría redactada (trigger).

## Anulación (`void_vaccination_record`)

Permiso elevado (administración de la organización), **motivo obligatorio**, idempotente.
No borra nada: el contenido (producto, lote, fechas) queda íntegro, el registro aparece
como "Anulada" en la cartilla y los recordatorios pendientes se **cancelan**. La corrección
se completa registrando un evento nuevo.
