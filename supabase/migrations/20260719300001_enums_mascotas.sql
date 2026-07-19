-- ============================================================================
-- Migración 0013 — Enums del dominio de pacientes (Fase 4)
-- ============================================================================
-- Mismo criterio de la Fase 2: vocabularios cerrados = ENUM.
-- ============================================================================

create type public.pet_species as enum ('dog', 'cat', 'other');

create type public.pet_sex as enum ('male', 'female', 'unknown');

create type public.owner_pet_relationship_type as enum (
  'owner', 'guardian', 'family_member', 'temporary_caregiver', 'other'
);

create type public.owner_pet_relationship_status as enum (
  'active', 'inactive', 'disputed', 'revoked'
);

create type public.clinic_pet_status as enum (
  'active', 'inactive', 'transferred', 'blocked', 'archived'
);

create type public.clinic_pet_source as enum (
  'manual', 'owner_registration', 'invitation', 'referral', 'import'
);

create type public.pet_alert_type as enum (
  'aggressive_behavior', 'escape_risk', 'handling_precaution',
  'communication_preference', 'billing_note', 'other'
);

create type public.pet_alert_severity as enum ('info', 'caution', 'critical');

create type public.contact_method as enum ('phone', 'email', 'whatsapp', 'sms');

create type public.consent_type as enum (
  'privacy_notice', 'data_processing', 'communications',
  'clinic_access', 'share_records', 'portal_terms'
);

create type public.consent_medium as enum ('in_person', 'web', 'email', 'phone');
