-- ============================================================================
-- Rollback for Migration 015: EHR Native Tables
-- Drops tables in reverse dependency order.
-- ============================================================================

-- Drop consent helper function first (references ehr_consent)
DROP FUNCTION IF EXISTS ehr_patient_has_consent(uuid, uuid, text);

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS ehr_audit_history;
DROP TABLE IF EXISTS ehr_service_request;
DROP TABLE IF EXISTS ehr_claim;
DROP TABLE IF EXISTS ehr_observation;
DROP TABLE IF EXISTS ehr_document_reference;
DROP TABLE IF EXISTS ehr_appointment;
DROP TABLE IF EXISTS ehr_encounter;
DROP TABLE IF EXISTS ehr_consent;
DROP TABLE IF EXISTS ehr_patient;
DROP TABLE IF EXISTS ehr_practitioner;

-- Drop shared trigger function (all triggers dropped with their tables)
DROP FUNCTION IF EXISTS ehr_update_updated_at();
