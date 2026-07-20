# Recetas — Sustitución y anulación

## Sustitución (`supersede_prescription`)

Una receta emitida **no se edita**: se sustituye por un documento nuevo.

1. Requiere **motivo** (`MOTIVO_REQUERIDO`) y un **veterinario activo** de la clínica
   (quien sustituye se vuelve prescriptor del nuevo documento).
2. El original debe estar `issued` y sin sustituto en curso (`ESTADO_INVALIDO`,
   `SUSTITUTO_EXISTENTE`; el índice único parcial `prescriptions_sustituto_activo`
   garantiza **un solo sustituto vivo** incluso ante concurrencia y evita ciclos junto con
   `enforce_prescription_refs`, que solo acepta sustituir documentos emitidos de la misma
   clínica y mascota).
3. Se crea un **borrador** que copia el contenido controlado (encabezado + partidas) y
   referencia al original (`supersedes_prescription_id`); el motivo queda en el historial.
4. El original **permanece `issued`** mientras el sustituto es borrador. Solo al **emitir**
   el sustituto (operación explícita) el original pasa a `superseded` con
   `superseded_by_prescription_id`, en la misma transacción.
5. **Ambos documentos se conservan** (contenido, partidas y documento congelado).

## Anulación (`void_prescription`)

1. Permiso **elevado**: administración de la organización (`is_organization_admin`).
2. **Motivo obligatorio**; idempotente si ya está anulada.
3. Aplica a `issued` y también a `superseded` (un documento sustituido puede resultar
   además inválido); un borrador **no se anula, se descarta**.
4. No borra nada: contenido, partidas y documento congelado quedan intactos; el documento
   imprimible muestra la marca "ANULADA".
5. El folio no se reutiliza y **no puede volver a emitirse** el mismo documento
   (`voided` es terminal).
6. Todo queda en `prescription_status_history` y en `audit_log` (redactado).
