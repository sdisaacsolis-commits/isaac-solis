# Finalización, adendas y anulación

## Requisitos mínimos para finalizar (`finalize_clinical_encounter`)

1. Motivo de consulta (`chief_complaint`) no vacío — `FALTA_MOTIVO`.
2. Nota con **evaluación (A) y plan (P)** — `NOTA_INCOMPLETA`.
3. Exploración capturada **o** `examination_skipped_reason` — `FALTA_EXPLORACION`.
4. Al menos una medición de vitales **o** `vitals_skipped_reason` — `FALTAN_VITALES`.

Finaliza el **veterinario responsable** (o administración que además tenga rol
veterinario: la firma es acto clínico). La RPC es idempotente y con `FOR UPDATE`
completa la cita vinculada si estaba en atención.

## Inmutabilidad de dos capas

1. **RLS**: las políticas de edición exigen `status = 'in_progress'`; sobre una consulta
   finalizada los UPDATE afectan **0 filas** (no hay error, no hay cambio).
2. **Triggers**: `enforce_encounter_open`/inmutabilidad de cabecera rechazan con
   `CONSULTA_INMUTABLE` cualquier escritura que se cuele (p. ej. vía definer mal usado).

## Adendas (`encounter_addenda`)

Append-only y **solo sobre consultas finalizadas** (`ADENDA_INVALIDA` en otro estado);
motivo obligatorio; sin UPDATE/DELETE para nadie. Son la única vía de corrección.

## Anulación (`void_clinical_encounter`)

Solo **administración de la organización**, con motivo obligatorio (`MOTIVO_REQUERIDO`).
El contenido queda **intacto** para auditoría, el folio no se reutiliza y la consulta
anulada no cuenta en métricas del panel.
