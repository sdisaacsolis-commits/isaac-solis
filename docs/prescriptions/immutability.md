# Recetas — Inmutabilidad

Una receta emitida es un **documento clínico-legal**: no se edita, no se borra, no se
"desemite". Correcciones = **sustitución** (documento nuevo que referencia al original) o
**anulación** (marca con motivo, contenido intacto). Igual que las consultas finalizadas
(Fase 6), la garantía vive en la base de datos en **dos capas**:

## Capa 1 — RLS y privilegios mínimos

- `UPDATE` de clientes limitado a 3 columnas del encabezado
  (`general_instructions`, `clinical_indication`, `valid_until`) y la política
  `prescriptions_update_borrador` solo alcanza borradores del prescriptor: sobre una
  emitida el cliente obtiene **0 filas**, sin error.
- `status`, `folio`, `issued_*`, `voided_*`, snapshots y referencias **no tienen grant**:
  cualquier intento directo → `42501`.
- Partidas: políticas de insert/update/delete atadas a `can_edit_prescription`
  (borrador vigente + prescriptor).
- Sin grant de `INSERT`/`DELETE` sobre `prescriptions` para clientes: todo pasa por RPCs.

## Capa 2 — Triggers (bloquean incluso a roles que omiten RLS)

- `enforce_prescription_transition`: valida la máquina de estados
  (`prescription_transition_allowed`) y exige el GUC transaccional
  `app.prescription_admin_op` para **cualquier** cambio de estado y para **cualquier**
  update fuera de `draft` (`RECETA_INMUTABLE` / `OPERACION_RESERVADA`). Solo las RPCs
  internas (`issue`, `supersede` al emitir, `void`) fijan ese GUC, y siempre `set_config
(..., true)` (transaccional: se limpia solo al terminar).
- `enforce_prescription_item_editable`: partidas solo mutan con receta en `draft` vigente
  (`RECETA_INMUTABLE`, dispara **antes** que el WITH CHECK de RLS).
- `prescription_documents`: trigger `enforce_document_frozen` — **ni update ni delete,
  sin excepción por GUC** (`DOCUMENTO_INMUTABLE`); además el `service_role` tiene revocados
  update/delete/truncate.
- `prescription_status_history`: append-only (sin grants de update/delete, incluso para
  service_role).

## Folios

Jamás se reutilizan: el contador solo avanza (los folios de recetas anuladas quedan
ocupados) y `unique (clinic_id, folio)` lo garantiza. Huecos por transacciones revertidas
son aceptables y están documentados.

## Verificación

Suite pgTAP 12: cliente 0-filas, trigger con rol postgres, doble emisión idempotente,
partidas bloqueadas, historial append-only, documento congelado, contenido intacto tras
anular. Las lecciones de Fase 6 aplican: para clientes, un UPDATE prohibido filtrado por
`USING` produce **0 filas** (no error), y los triggers `BEFORE` disparan antes que el
`WITH CHECK` de las políticas de INSERT.
