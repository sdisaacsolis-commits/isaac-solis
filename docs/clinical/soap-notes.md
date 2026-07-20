# Nota clínica (SOAP)

- **Una sola nota por consulta** (`clinical_notes.encounter_id` UNIQUE): antecedentes
  (`history_summary`) + S/O/A/P. Decisión: una nota versionada es más simple y auditable
  que múltiples notas sueltas.
- **Control optimista por versión**: el trigger `bump_version` incrementa `version` en cada
  UPDATE. La UI envía `expectedVersion` oculto y el servidor ejecuta
  `UPDATE … WHERE encounter_id = X AND version = esperada`; **0 filas afectadas = conflicto**
  y el usuario ve «Alguien más guardó cambios; recarga la sección.» Si la nota no existe se
  hace INSERT (un 23505 concurrente también se reporta como conflicto).
- Texto plano siempre (la UI renderiza con `whitespace-pre-line`); sin HTML.
- Escritura solo con la consulta `in_progress` y rol veterinario (RLS +
  `enforce_encounter_open`); requisito de finalización: evaluación (A) y plan (P) no vacíos.
- `author_clinic_member_id` registra quién capturó (membresía, no user suelto).

La exploración física (`encounter_examinations`) sigue exactamente el mismo patrón de
versión/conflicto; ver `vitals.md` para los signos vitales (append-only, sin versiones).
