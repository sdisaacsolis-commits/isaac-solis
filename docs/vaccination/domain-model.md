# Vacunación — Modelo de dominio (Fase 7)

## Principio rector

Una vacunación aplicada es un **evento clínico histórico**: no se sobrescribe jamás
(corrección = anular + registrar de nuevo). Dogtoralia **no recomienda** qué vacuna aplicar
ni cuándo: el catálogo es interno y no prescriptivo, y la próxima dosis siempre la
**confirma el veterinario**.

## Entidades

| Tabla                        | Propósito                                                    |
| ---------------------------- | ------------------------------------------------------------ |
| `vaccines_catalog`           | Catálogo de productos **por organización** (no prescriptivo) |
| `vaccination_records`        | Evento de vacunación inmutable con snapshot del producto     |
| `vaccination_status_history` | Historial append-only (`recorded → voided`)                  |
| `vaccination_documents`      | Comprobante individual congelado + SHA-256                   |
| `vaccination_notifications`  | Outbox de recordatorios (correo en esta fase)                |

## Catálogo

- Ámbito **organización** (`organization_id NOT NULL`). El catálogo global de referencia
  se **pospone** (decisión documentada): evita introducir contenido con apariencia
  prescriptiva y arranca con registros controlados por cada organización.
- `default_booster_interval_days` es **solo una ayuda editable**: pre-llena un campo de
  fecha que el veterinario puede cambiar y siempre debe confirmar. Nunca se aplica
  automáticamente ni se presenta como recomendación.
- Lo administran la administración de la organización y los `clinic_admin` de sus clínicas.

## Registro (`vaccination_records`)

- **Estados**: `recorded` → `voided` (terminal). Nada más.
- **Fuentes** (`vaccination_source`): `administered_in_clinic`,
  `historical_owner_document`, `external_clinic`, `campaign`, `import`. La fuente
  distingue SIEMPRE lo verificado por la clínica de lo aportado — en la base, en la UI y
  en los documentos.
- **Snapshot del producto** (`vaccine_name_snapshot`, `manufacturer_snapshot`,
  `diseases_snapshot`): el evento histórico no depende del catálogo mutable.
- Aplicación en clínica: `administered_by_clinic_member_id` obligatorio (veterinario
  activo, validado por trigger), hora del **servidor**, lote+caducidad obligatorios (o
  excepción justificada — ver `lots-and-expiration.md`).
- Histórico: sin veterinario interno; `historical_provider_name`,
  `historical_document_reference` y comprobante opcional en bucket privado
  `vaccination-files`.
- **Idempotencia explícita**: `client_request_id` + índice único parcial por clínica. La
  semejanza de nombre/fecha jamás se usa para deducir duplicados.
- Integridad temporal en **triggers** (no CHECKs con `now()`): sin fechas de aplicación
  futuras; caducidad ≥ fecha de aplicación; próxima dosis futura.

## Fuera de alcance

Recomendaciones automáticas de esquemas de vacunación, certificados oficiales
gubernamentales, inventario y consumo automático, WhatsApp/push (correo únicamente).
