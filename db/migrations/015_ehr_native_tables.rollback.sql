-- ============================================================================
-- Rollback for Migration 015: EHR Native Tables
-- Drops tables in reverse dependency order.
-- ============================================================================

-- Drop tables first (this drops their RLS policies that depend on the function)
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

-- Now safe to drop functions (table policies that referenced them are gone)
DROP FUNCTION IF EXISTS ehr_patient_has_consent(uuid, uuid, text);
DROP FUNCTION IF EXISTS ehr_update_updated_at();
