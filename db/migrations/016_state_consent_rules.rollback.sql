-- Rollback migration 016: State Consent Rules Engine

-- Drop functions first (they reference tables)
DROP FUNCTION IF EXISTS ehr_get_active_state_consent_rules(TEXT, UUID);
DROP FUNCTION IF EXISTS ehr_get_next_rule_version(TEXT, UUID);

-- Drop tables in reverse dependency order (audit has FK to main)
DROP TABLE IF EXISTS ehr_state_consent_rules_audit;
DROP TABLE IF EXISTS ehr_state_consent_rules;

-- Note: ehr_update_updated_at() is a shared trigger function created in migration 015, do not drop it here
