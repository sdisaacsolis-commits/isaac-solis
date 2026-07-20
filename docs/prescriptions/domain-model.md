# Recetas — Modelo de dominio (Fase 7)

## Principio rector

**Dogtoralia documenta decisiones del veterinario; no toma decisiones clínicas.** En ninguna
capa (base de datos, validación, UI) se calculan dosis, se sugieren medicamentos, se
recomiendan tratamientos ni se infiere nada a partir del peso. Todo el contenido clínico de
una receta es **texto capturado por el veterinario**; el sistema valida estructura, longitud
y obligatoriedad — nunca corrección clínica.

## Entidades

| Tabla | Propósito |
| --- | --- |
| `prescriptions` | Receta: ciclo de vida, folio, snapshots congelados, referencias |
| `prescription_items` | Partidas (medicamentos e indicaciones) con orden por `position` |
| `prescription_status_history` | Historial de estados append-only (por trigger) |
| `prescription_documents` | Documento canónico congelado al emitir + SHA-256 |
| `prescription_folio_counters` | Contadores de folio por clínica+año (UPSERT atómico) |

## Estados

`draft → issued → superseded | voided`, y `superseded → voided`. `voided` es terminal.
**No existe "desemitir"**. Un borrador no se anula: se **descarta** (borrado lógico
`deleted_at` vía `discard_prescription_draft`, solo el prescriptor).

- `draft`: editable únicamente por el veterinario prescriptor (RLS + trigger).
- `issued`: **inmutable** (dos capas: RLS deja 0 filas al cliente y el trigger
  `RECETA_INMutABLE`/`OPERACION_RESERVADA` bloquea incluso a roles que omiten RLS; las
  transiciones legales pasan por RPCs con GUC transaccional `app.prescription_admin_op`).
- `superseded`: sustituida por otra receta emitida; **ambos documentos se conservan**.
- `voided`: anulada con motivo; contenido, partidas y documento intactos.

## Relación con la consulta clínica

- Toda receta nace de una consulta (`encounter_id NOT NULL`).
- Se puede **preparar como borrador durante la consulta abierta** (`in_progress`), pero la
  **emisión exige consulta `finalized`** (decisión documentada en `issuing-flow.md`).
- El propietario responsable se resuelve en servidor: el de la cita si existe; si no, el
  principal activo de la mascota.
- El prescriptor es el veterinario activo que crea el borrador; solo él emite.

## Snapshots (documentos históricos ≠ perfiles mutables)

Al emitir, el servidor congela en jsonb: clínica (nombre, dirección, contacto), prescriptor
(nombre y **cédula profesional** `clinic_members.professional_license`), mascota (especie,
raza, sexo, nacimiento, microchip y **peso disponible de la consulta** — última medición de
`clinical_vitals`), y propietario responsable. **No existe grant de escritura sobre esas
columnas**: el cliente jamás envía JSON de snapshots.

## Campos clínicos de las partidas

`dosage_text`, `route_text`, `frequency_text` y `duration_text` son **obligatorios y de
texto libre**: el sistema no valida dosis clínicas con reglas inventadas ni convierte
valores. `position` conserva el orden de aparición (sin UNIQUE para permitir reordenar sin
transacción desde el cliente; desempate estable por `created_at`).

## Fuera de alcance (Fase 7)

Prescripción automática, interacciones, recomendaciones de dosis, IA clínica, dispensación
o venta, inventario, sustancias controladas y libros de control, firma electrónica
certificada o biométrica, facturación, certificados gubernamentales, portal del
propietario, compartición entre organizaciones.
