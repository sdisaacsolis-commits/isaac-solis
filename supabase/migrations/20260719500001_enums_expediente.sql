-- ============================================================================
-- Fase 6 — Expediente clínico: enums
-- ============================================================================

-- DECISIÓN: draft e in_progress se fusionan. La consulta se crea cuando la
-- atención inicia; todo lo anterior a finalizar ES el borrador editable.
-- Un estado draft separado agregaría una transición sin significado operativo
-- (docs/clinical/domain-model.md).
create type public.encounter_status as enum ('in_progress', 'finalized', 'voided');

-- remote_future se omite deliberadamente: telemedicina está fuera de alcance
-- y no aporta valor inmediato (el enum puede extenderse en el futuro).
create type public.encounter_type as enum (
  'scheduled', 'walk_in', 'emergency', 'follow_up', 'other'
);

create type public.diagnosis_certainty as enum (
  'differential', 'presumptive', 'confirmed', 'ruled_out'
);

create type public.treatment_type as enum (
  'medication_recommendation', -- indicación de medicamento (NO es receta legal)
  'procedure', 'diet', 'home_care', 'restriction', 'referral', 'follow_up', 'other'
);

create type public.clinical_file_kind as enum (
  'laboratory_result', 'image', 'external_prescription', 'referral', 'consent', 'other'
);

create type public.follow_up_status as enum ('pending', 'scheduled', 'completed', 'cancelled');
