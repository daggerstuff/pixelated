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
