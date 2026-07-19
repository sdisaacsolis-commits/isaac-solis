# Agenda — Folios de cita

Formato: **`CIT-AAAA-NNNNNN`** (p. ej. `CIT-2026-000123`), secuencial **por
clínica y por año**. El año es el de `scheduled_start` en la zona de la
clínica (una cita de enero agendada en diciembre pertenece al folio del año
de la cita).

## Cómo se genera (concurrencia-seguro)

`next_appointment_folio(clinic, year)` hace un **UPSERT atómico** sobre
`appointment_folio_counters`:

```sql
insert into appointment_folio_counters as c (clinic_id, year, counter)
values ($1, $2, 1)
on conflict (clinic_id, year) do update set counter = c.counter + 1
returning counter;
```

Dos transacciones simultáneas se serializan en la fila del contador y reciben
valores distintos. **Jamás `COUNT(*) + 1`**: eso produce folios duplicados en
concurrencia y se rompe con cancelaciones.

## Propiedades

- Único por clínica (`unique (clinic_id, folio)`) y con formato validado por
  `CHECK` (y `appointmentFolioSchema` en TS).
- **Puede haber huecos**: si la transacción de reserva falla después de tomar
  el folio (p. ej. por traslape), ese número se pierde. Es aceptable: el folio
  identifica, no contabiliza.
- El folio **se conserva al reagendar** (misma cita, misma identidad).
- La tabla de contadores no es consultable por clientes (RLS forzado sin
  políticas; solo la función DEFINER la toca).
