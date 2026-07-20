# Archivos clínicos

- **Bucket privado `clinical-files`** (creado por migración); jamás público. Binarios en
  Storage, metadata en `clinical_files`.
- Ruta interna sin datos del usuario: `pets/{petId}/encounters/{encounterId}/{uuid}.{ext}`.
  Las políticas de Storage derivan el encounter de la ruta
  (`clinical_encounter_from_storage_path`) y validan acceso + rol; **sin enumeración**:
  no hay listado público ni URLs adivinables.
- **Tipos permitidos**: PDF, JPEG, PNG y WebP. La server action valida el tamaño
  (`CLINICAL_FILE_MAX_MB`, 10 MB por defecto) y el **MIME real por magic bytes**
  (`%PDF`, `FF D8 FF`, firma PNG, `RIFF…WEBP`); la cabecera declarada no se confía.
  SVG excluido a propósito (riesgo XSS).
- Subida con el **cliente del usuario** (nunca service_role): Storage + insert de
  metadata; si la metadata falla, el binario se elimina (mejor esfuerzo; huérfanos quedan
  inaccesibles por RLS).
- Suben veterinarios y administración de la clínica; con la consulta anulada no se
  adjunta (trigger `enforce_encounter_not_voided` → `CONSULTA_INMUTABLE`); en finalizadas
  sí (evidencia posterior, p. ej. resultados de laboratorio).
- **Descarga**: server action que registra `file_download` en la bitácora
  (`log_clinical_record_access`) y redirige a una URL firmada de corta vida
  (`CLINICAL_FILE_SIGNED_URL_SECONDS`, 300 s por defecto). Nunca se persisten URLs.
