-- Migration 017: Add active column to ehr_resource and 7 dedicated tables
-- The active column enables FHIR soft-delete (active=false) per FHIR R4 spec.
-- ehr_patient and ehr_practitioner already have active (migration 015).
-- ehr_resource (migration 016) was missing it.
-- 7 dedicated tables (encounter, observation, appointment, document_reference,
--   claim, consent, service_request) were missing it.

-- ehr_resource (generic table for 14 resource types)
ALTER TABLE ehr_resource
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ehr_resource_active
  ON ehr_resource (tenant_id, active)
  WHERE active = false;

-- Dedicated tables missing active column
ALTER TABLE ehr_encounter
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ehr_encounter_active
  ON ehr_encounter (tenant_id, active)
  WHERE active = false;

ALTER TABLE ehr_observation
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ehr_observation_active
  ON ehr_observation (tenant_id, active)
  WHERE active = false;

ALTER TABLE ehr_appointment
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ehr_appointment_active
  ON ehr_appointment (tenant_id, active)
  WHERE active = false;

ALTER TABLE ehr_document_reference
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ehr_document_reference_active
  ON ehr_document_reference (tenant_id, active)
  WHERE active = false;

ALTER TABLE ehr_claim
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ehr_claim_active
  ON ehr_claim (tenant_id, active)
  WHERE active = false;

ALTER TABLE ehr_consent
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ehr_consent_active
  ON ehr_consent (tenant_id, active)
  WHERE active = false;

ALTER TABLE ehr_service_request
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_ehr_service_request_active
  ON ehr_service_request (tenant_id, active)
  WHERE active = false;
