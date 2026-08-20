-- Rollback: drop generic FHIR resource tables.
DROP TABLE IF EXISTS ehr_resource_history;
DROP TABLE IF EXISTS ehr_resource;
