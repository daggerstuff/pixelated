# EHR Native Database Migrations

Migration SQL files for the EHR native module.

## Structure

All EHR tables follow the multi-tenant RLS pattern established in ADR-001:

- `tenant_id UUID NOT NULL` column
- RLS policy: `(tenant_id = current_setting('app.tenant_id')::UUID)`
- FHIR R4 resources stored as JSONB (see ADR-002)

## Planned migrations

- `001_initial_schema.sql` — FHIR resource tables, _history tables, indexes
- `002_rls_policies.sql` — Row-level security policies for EHR tables
- `003_audit_extension.sql` — Audit log extension for EHR events
- `004_consent_tables.sql` — Consent records and state-rules config
