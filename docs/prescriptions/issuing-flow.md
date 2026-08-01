# Recetas — Flujo de emisión

## Borrador

1. `create_prescription_draft(encounter_id)` — solo un **veterinario activo** de la clínica.
   La consulta puede estar `in_progress` o `finalized` (nunca `voided`).
2. El prescriptor edita encabezado (instrucciones generales, indicación clínica, vigencia)
   con **concurrencia optimista** (columna `version` + `eq(version)`; 0 filas → "Alguien
   más guardó cambios") y captura partidas (insert/update/delete directos bajo RLS; el
   trigger `enforce_prescription_item_editable` garantiza borrador vigente).
3. Un borrador puede descartarse (`discard_prescription_draft`, borrado lógico, solo el
   prescriptor). Un borrador descartado no puede emitirse.

## Emisión — `issue_prescription(prescription_id)`

Transaccional y segura ante concurrencia:

1. **Bloquea la fila** (`FOR UPDATE`).
2. Si ya está `issued` → devuelve el folio existente (**idempotente**: la repetición no
   crea otro folio ni otro documento).
3. Verifica estado `draft` (superseded/voided → `TRANSICION_INVALIDA`).
4. Verifica que quien llama es el **prescriptor** y sigue siendo veterinario activo
   (`PERMISO_DENEGADO`).
5. Verifica **consulta finalizada** (`CONSULTA_NO_FINALIZADA`).
6. Verifica al menos una partida (`RECETA_SIN_PARTIDAS`).
7. Si es sustitución: bloquea el original y verifica que sigue emitido y sin sustituto
   (`SUSTITUCION_INVALIDA`).
8. Genera folio `REC-AAAA-NNNNNN` (contador UPSERT, año en zona horaria de la clínica).
9. Congela snapshots en servidor (ver `domain-model.md`).
10. `issued_at = now()` (hora del servidor), `issued_by`, estado `issued` (GUC transaccional).
11. Marca el original como `superseded` **solo en este momento** (si aplica).
12. Congela el **documento canónico** con SHA-256 (ver `documents.md`).
13. El historial y la auditoría redactada se registran por triggers.

Doble emisión concurrente: el segundo llamador espera el candado y cae en el paso 2
(idempotencia) — jamás dos folios. Probado en pgTAP (suite 12).

## Emisión y finalización de la consulta

La emisión **no** forma parte de `finalize_clinical_encounter`: son actos distintos (una
consulta puede terminar sin receta, y una receta puede prepararse antes y emitirse justo
después de finalizar). La UI ofrece "Crear receta" desde la consulta finalizada.

## Errores estables

`CONSULTA_NO_FINALIZADA`, `RECETA_SIN_PARTIDAS`, `PERMISO_DENEGADO`, `TRANSICION_INVALIDA`,
`SUSTITUCION_INVALIDA`, `RECETA_NO_ENCONTRADA`, `PROPIETARIO_REQUERIDO`,
`MOTIVO_REQUERIDO`, `SUTITUTO/SUSTITUTO_EXISTENTE` — mapeados a español en
`apps/web/src/lib/recetas/actions.ts`.
