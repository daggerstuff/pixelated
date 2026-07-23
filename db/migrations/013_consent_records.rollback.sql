-- Rollback: 013_consent_records.rollback.sql
-- Drop consent_records and consent_audit_trail tables
--

BEGIN;

DROP TABLE IF EXISTS consent_audit_trail;
DROP TABLE IF EXISTS consent_records;

COMMIT;
