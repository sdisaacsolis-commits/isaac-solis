-- ============================================================================
-- Fase 7 — Enums de recetas y vacunación
-- ============================================================================
-- Principio rector (docs/prescriptions/domain-model.md): Dogtoralia DOCUMENTA
-- decisiones del veterinario; no calcula dosis, no sugiere medicamentos ni
-- recomienda tratamientos en ninguna capa.
-- ============================================================================

-- Estados de una receta. draft es editable; issued es INMUTABLE; superseded
-- y voided conservan íntegro el contenido original. No existe "desemitir".
create type public.prescription_status as enum (
  'draft',      -- borrador editable por el veterinario prescriptor
  'issued',     -- emitida: documento clínico inmutable con folio
  'superseded', -- sustituida por otra receta emitida (ambas se conservan)
  'voided'      -- anulada con motivo (contenido y folio intactos)
);

-- Estados de un registro de vacunación: evento histórico, jamás se edita.
create type public.vaccination_record_status as enum (
  'recorded', -- registrado (correcciones = anular + registrar de nuevo)
  'voided'    -- anulado con motivo (contenido intacto)
);

-- Origen del registro: distingue SIEMPRE lo aplicado y verificado en la
-- clínica de lo aportado por el propietario o terceros.
create type public.vaccination_source as enum (
  'administered_in_clinic',    -- aplicada aquí por un veterinario activo
  'historical_owner_document', -- registro histórico aportado por el propietario
  'external_clinic',           -- aplicada por un tercero identificado
  'campaign',                  -- campaña de vacunación
  'import'                     -- migración/importación de datos
);

-- Tipos de notificación del outbox de vacunación (correo en esta fase).
create type public.vaccination_notification_type as enum (
  'next_dose_due' -- recordatorio de próxima dosis/refuerzo confirmada por el veterinario
);
