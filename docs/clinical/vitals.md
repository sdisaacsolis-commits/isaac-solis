# Signos vitales

- `clinical_vitals` es **append-only**: cada captura es una medición nueva con
  `recorded_at`/`recorded_by`; no hay UPDATE ni DELETE (ni siquiera para `service_role`).
  Una medición equivocada se corrige registrando otra (y, tras finalizar, con adenda).
- Campos: peso (kg), temperatura (°C), frecuencia cardiaca/respiratoria, llenado capilar,
  condición corporal (1–9), dolor (0–10), hidratación, mucosas, presión arterial y notas.
  Todos opcionales: se captura lo que se midió.
- Validación en dos capas: Zod (`vitalsSchema`) con rangos físicamente posibles en la
  frontera, y `CHECK` en la base como autoridad final.
- **Quién captura**: veterinarios y **asistentes** (`can_record_vitals`); los asistentes ven
  contenido clínico y capturan vitales pero no diagnostican (ver `privacy.md`).
- Omisión justificada: si la consulta se finaliza sin mediciones, la cabecera debe llevar
  `vitals_skipped_reason` (`FALTAN_VITALES` si no).
- El documento impreso muestra la última medición y la tabla completa (`printing.md`).
