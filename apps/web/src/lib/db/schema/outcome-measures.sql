-- F2.4 Outcome Measure Trending — measure configuration persistence
-- Stores per-patient outcome measure cadence and active status.
-- Follows ehr_<resource> convention with fhir_resource JSONB column.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ehr_measure_config (
  measure_config_id  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          TEXT          NOT NULL,
  patient_id         TEXT          NOT NULL,
  measure_type       TEXT          NOT NULL,
  cadence            TEXT          NOT NULL DEFAULT 'weekly',
  active             BOOLEAN       NOT NULL DEFAULT TRUE,
  fhir_resource      JSONB         NOT NULL,
  created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_measure_config_tenant_patient
  ON ehr_measure_config (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_measure_config_patient_measure
  ON ehr_measure_config (patient_id, measure_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_measure_config_patient_measure_unique
  ON ehr_measure_config (tenant_id, patient_id, measure_type);

-- Enable Row Level Security
ALTER TABLE ehr_measure_config ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access rows for their tenant
CREATE POLICY IF NOT EXISTS ehr_measure_config_tenant_isolation
  ON ehr_measure_config
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

-- RLS policy: SELECT requires active patient consent OR break-glass OR complianceOfficer/systemAdmin
-- Mirrors ehr_observation consent gating from 015_ehr_native_tables.sql
CREATE POLICY IF NOT EXISTS ehr_measure_config_select_consent
  ON ehr_measure_config FOR SELECT
  USING (
      tenant_id = current_setting('app.tenant_id', true)
      AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
          'physician', 'nurse', 'pharmacist', 'medicalAssistant',
          'technician', 'therapist', 'careCoordinator', 'billingSpecialist',
          'complianceOfficer', 'healthInformationManager', 'systemAdmin'
      )
      AND (
          ehr_patient_has_consent(patient_id, tenant_id, 'minimal')
          OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
          OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
              'complianceOfficer', 'systemAdmin'
          )
      )
  );

-- RLS policy: INSERT requires clinical role in tenant
CREATE POLICY IF NOT EXISTS ehr_measure_config_insert
  ON ehr_measure_config FOR INSERT
  WITH CHECK (
      tenant_id = current_setting('app.tenant_id', true)
      AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
          'physician', 'nurse', 'pharmacist', 'medicalAssistant',
          'technician', 'therapist', 'careCoordinator', 'systemAdmin'
      )
  );

-- RLS policy: UPDATE requires clinical role with consent or break-glass
CREATE POLICY IF NOT EXISTS ehr_measure_config_update
  ON ehr_measure_config FOR UPDATE
  USING (
      tenant_id = current_setting('app.tenant_id', true)
      AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
          'physician', 'nurse', 'pharmacist', 'medicalAssistant',
          'technician', 'therapist', 'careCoordinator', 'systemAdmin'
      )
      AND (
          ehr_patient_has_consent(patient_id, tenant_id, 'minimal')
          OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
          OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
              'complianceOfficer', 'systemAdmin'
          )
      )
  )
  WITH CHECK (
      tenant_id = current_setting('app.tenant_id', true)
      AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
          'physician', 'nurse', 'pharmacist', 'medicalAssistant',
          'technician', 'therapist', 'careCoordinator', 'systemAdmin'
      )
  );

-- RLS policy: DELETE restricted to systemAdmin
CREATE POLICY IF NOT EXISTS ehr_measure_config_delete
  ON ehr_measure_config FOR DELETE
  USING (
      tenant_id = current_setting('app.tenant_id', true)
      AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
  );

-- Audit hash-chain trigger for tamper-evident measure config changes
-- Follows the pattern from docs/database/schema-ddl-v1.sql (pe.compute_audit_hash)
CREATE TABLE IF NOT EXISTS ehr_measure_config_audit (
  audit_id        UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       TEXT          NOT NULL,
  measure_config_id UUID        NOT NULL,
  patient_id      TEXT          NOT NULL,
  measure_type    TEXT          NOT NULL,
  action          TEXT          NOT NULL,
  actor_id        TEXT,
  prev_hash      VARCHAR(64),
  row_hash       VARCHAR(64)    NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION ehr_measure_config_compute_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash VARCHAR(64);
    row_content TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('ehr_measure_config_audit_chain_head'));

    SELECT row_hash INTO last_hash
    FROM ehr_measure_config_audit
    ORDER BY created_at DESC, audit_id DESC
    LIMIT 1;

    NEW.prev_hash := last_hash;

    row_content := COALESCE(NEW.tenant_id, '') || '|' ||
                   COALESCE(NEW.measure_config_id::text, '') || '|' ||
                   COALESCE(NEW.patient_id, '') || '|' ||
                   COALESCE(NEW.measure_type, '') || '|' ||
                   COALESCE(NEW.action, '') || '|' ||
                   COALESCE(NEW.actor_id, '') || '|' ||
                   COALESCE(last_hash, '') || '|' ||
                   COALESCE(NEW.created_at::text, '');

    NEW.row_hash := encode(digest(row_content, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_measure_config_audit_hash') THEN
        CREATE TRIGGER ehr_measure_config_audit_hash
            BEFORE INSERT ON ehr_measure_config_audit
            FOR EACH ROW
            EXECUTE FUNCTION ehr_measure_config_compute_audit_hash();
    END IF;
END $$;

-- Prevent mutation of audit rows
CREATE OR REPLACE FUNCTION ehr_measure_config_prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Measure config audit log is immutable: UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_measure_config_prevent_audit_update') THEN
        CREATE TRIGGER ehr_measure_config_prevent_audit_update
            BEFORE UPDATE ON ehr_measure_config_audit
            FOR EACH ROW EXECUTE FUNCTION ehr_measure_config_prevent_audit_mutation();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_measure_config_prevent_audit_delete') THEN
        CREATE TRIGGER ehr_measure_config_prevent_audit_delete
            BEFORE DELETE ON ehr_measure_config_audit
            FOR EACH ROW EXECUTE FUNCTION ehr_measure_config_prevent_audit_mutation();
    END IF;
END $$;

-- Audit trigger on ehr_measure_config: log INSERT/UPDATE/DELETE to audit table
CREATE OR REPLACE FUNCTION ehr_measure_config_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    actor TEXT;
BEGIN
    actor := current_setting('request.jwt.claims', true)::jsonb->>'sub';
    IF TG_OP = 'DELETE' THEN
        INSERT INTO ehr_measure_config_audit (tenant_id, measure_config_id, patient_id, measure_type, action, actor_id)
        VALUES (OLD.tenant_id, OLD.measure_config_id, OLD.patient_id, OLD.measure_type, 'DELETE', actor);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO ehr_measure_config_audit (tenant_id, measure_config_id, patient_id, measure_type, action, actor_id)
        VALUES (NEW.tenant_id, NEW.measure_config_id, NEW.patient_id, NEW.measure_type, 'UPDATE', actor);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO ehr_measure_config_audit (tenant_id, measure_config_id, patient_id, measure_type, action, actor_id)
        VALUES (NEW.tenant_id, NEW.measure_config_id, NEW.patient_id, New.measure_type, 'INSERT', actor);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_measure_config_audit_dml') THEN
        CREATE TRIGGER ehr_measure_config_audit_dml
            AFTER INSERT OR UPDATE OR DELETE ON ehr_measure_config
            FOR EACH ROW EXECUTE FUNCTION ehr_measure_config_audit_trigger();
    END IF;
END $$;
