-- Rollback: Remove active column from ehr_resource and 7 dedicated tables

DROP INDEX IF EXISTS idx_ehr_service_request_active;
ALTER TABLE ehr_service_request DROP COLUMN IF EXISTS active;

DROP INDEX IF EXISTS idx_ehr_consent_active;
ALTER TABLE ehr_consent DROP COLUMN IF EXISTS active;

DROP INDEX IF EXISTS idx_ehr_claim_active;
ALTER TABLE ehr_claim DROP COLUMN IF EXISTS active;

DROP INDEX IF EXISTS idx_ehr_document_reference_active;
ALTER TABLE ehr_document_reference DROP COLUMN IF EXISTS active;

DROP INDEX IF EXISTS idx_ehr_appointment_active;
ALTER TABLE ehr_appointment DROP COLUMN IF EXISTS active;

DROP INDEX IF EXISTS idx_ehr_observation_active;
ALTER TABLE ehr_observation DROP COLUMN IF EXISTS active;

DROP INDEX IF EXISTS idx_ehr_encounter_active;
ALTER TABLE ehr_encounter DROP COLUMN IF EXISTS active;

DROP INDEX IF EXISTS idx_ehr_resource_active;
ALTER TABLE ehr_resource DROP COLUMN IF EXISTS active;
