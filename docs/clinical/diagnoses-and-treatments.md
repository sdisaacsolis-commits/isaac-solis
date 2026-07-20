# Diagnósticos, tratamientos y seguimiento

## Diagnósticos (`diagnoses`)

- Nombre + descripción + **certeza** (`differential`/`presumptive`/`confirmed`/`ruled_out`)
  y bandera `is_primary`.
- **Un solo principal por consulta**: índice único parcial; el segundo intento devuelve
  23505 y la UI muestra «Ya existe un diagnóstico principal en esta consulta.»
- Retiro por **soft-delete** (`deleted_at`) mientras la consulta está abierta; nada se
  borra físicamente. Campos `code_system`/`code` reservados para catálogos (VeNom/SNOMED)
  **[Propuesta]** futura.

## Tratamientos (`encounter_treatments`)

- Tipo (8: medicamento recomendado, procedimiento, dieta, cuidados en casa, restricción,
  referencia, seguimiento, otro) + nombre + indicaciones y dosis/vía/frecuencia/duración
  en texto libre. `performed_during_encounter` distingue lo aplicado en sitio.
- **No es receta**: la prescripción formal con PDF e inmutabilidad propia llega en la
  Fase 7 y referenciará la consulta.

## Seguimiento (`encounter_follow_ups`)

- Motivo + plazo recomendado (días) + servicio sugerido; `status`/`appointment_id` quedan
  listos para enlazar la cita de seguimiento cuando se agende.

Todo lo anterior solo se escribe con la consulta `in_progress` y rol veterinario
(`can_edit_clinical_encounter` + trigger `enforce_encounter_open`).
