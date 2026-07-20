# Expediente clínico — Modelo de dominio (Fase 6)

## Entidades

| Tabla                      | Propósito                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `clinical_encounters`      | Cabecera de la consulta: folio `CON-AAAA-NNNNNN`, paciente, veterinario responsable, tipo, estado, motivo. |
| `clinical_notes`           | Nota SOAP 1:1 (antecedentes + S/O/A/P), **versionada** para control optimista.                             |
| `encounter_examinations`   | Exploración física por sistemas 1:1 (14 campos + observaciones), versionada.                               |
| `clinical_vitals`          | Mediciones de signos vitales **append-only** (varias por consulta).                                        |
| `diagnoses`                | Diagnósticos con certeza y principal único (índice parcial); retiro por soft-delete.                       |
| `encounter_treatments`     | Tratamientos e indicaciones en texto; soft-delete mientras la consulta está abierta.                       |
| `encounter_follow_ups`     | Seguimientos recomendados (motivo, plazo, servicio sugerido).                                              |
| `clinical_files`           | Metadata de adjuntos; binarios en el bucket privado `clinical-files` (ver `files.md`).                     |
| `encounter_addenda`        | Correcciones append-only sobre consultas finalizadas (ver `finalization-and-addenda.md`).                  |
| `encounter_status_history` | Historial de estados append-only poblado por trigger.                                                      |
| `clinical_folio_counters`  | Contadores de folio por clínica y año (solo funciones DEFINER).                                            |

## Decisiones

- **Cita ≠ consulta**: la cita es agenda (Fase 5); la consulta es el acto clínico. Una cita
  produce a lo más una consulta no anulada (`appointment_id` con índice único parcial) y una
  consulta walk-in genera su cita interna para conservar métricas y ocupación.
- **`draft` + `in_progress` fusionados**: la consulta abierta ES el borrador (ver
  `encounter-flow.md`); menos estados, menos transiciones inválidas.
- Todo cuelga de `clinic_pet_relationships`: sin relación activa clínica–mascota no hay
  consulta (`MASCOTA_SIN_RELACION`).
- Preparación futura: vacunas (Fase 6+), recetas (Fase 7) y adjuntos avanzados referenciarán
  `clinical_encounters`; el folio y la inmutabilidad ya lo soportan.
