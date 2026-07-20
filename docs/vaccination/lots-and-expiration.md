# Vacunación — Lotes y caducidades

## Aplicaciones en clínica (obligatorio)

- **Lote** (`lot_number`): obligatorio. Excepción única: `lot_missing_reason` documenta por
  qué no está disponible (p. ej. empaque sin etiqueta) — queda registrada, auditada y
  visible; la constraint `vaccination_records_aplicacion_en_clinica` exige lote+caducidad
  **o** justificación.
- **Caducidad** (`expiration_date`): obligatoria cuando hay lote (`CADUCIDAD_REQUERIDA`).
- **Producto caducado**: `PRODUCTO_CADUCADO` — no se puede registrar la aplicación de un
  producto con caducidad anterior a la fecha de aplicación. Refuerzo estructural: la
  constraint `vaccination_records_caducidad_coherente`
  (`expiration_date >= administered_at::date`) aplica a TODA fila.
- **Fechas**: sin aplicaciones futuras (trigger, tolerancia de 5 minutos de reloj);
  `next_due_at` siempre posterior a la aplicación.

## Registros históricos (según disponibilidad)

Lote y caducidad se capturan **si el documento aportado los trae**; pueden faltar. La
coherencia caducidad ≥ aplicación se mantiene; si el documento histórico muestra un
producto vencido al aplicarse, se registra la observación en `notes` en lugar de falsear
fechas.

## Privacidad de lotes

Los lotes son datos operativos de cada clínica: la auditoría es **redactada** (jamás se
copia el lote a `audit_log` — probado en pgTAP) y RLS impide que otra organización consulte
lotes ajenos, incluso con mascota compartida.

## UI

Advertencias no prescriptivas: producto caducado, caducidad anterior a la aplicación, lote
faltante, registro histórico sin documentación, próxima dosis sin confirmar. Son avisos de
captura, nunca recomendaciones clínicas automáticas.
