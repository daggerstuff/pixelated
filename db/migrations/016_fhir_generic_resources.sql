-- 016: Generic FHIR R4 resource table for resource types without dedicated tables.
-- Supports: Condition, AllergyIntolerance, MedicationRequest, Medication,
-- Immunization, Procedure, DiagnosticReport, Schedule, Slot, ClaimResponse,
-- Coverage, ExplanationOfBenefit, Communication, CommunicationRequest.
--
-- Uses same RLS patterns as migration 015: tenant isolation via app.tenant_id,
-- role checks via jwt.claims, consent checks via ehr_patient_has_consent().

-- ehr_resource: generic storage for FHIR resources without dedicated tables.
CREATE TABLE IF NOT EXISTS ehr_resource (
  resource_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  patient_id UUID,
  status TEXT,
  fhir_resource JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying.
CREATE INDEX IF NOT EXISTS idx_ehr_resource_tenant ON ehr_resource (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_resource_type ON ehr_resource (resource_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_resource_patient ON ehr_resource (patient_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_resource_status ON ehr_resource (status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_resource_created ON ehr_resource (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_resource_fhir_gin ON ehr_resource USING GIN (fhir_resource);

-- Composite index for type+patient+status searches.
CREATE INDEX IF NOT EXISTS idx_ehr_resource_type_patient ON ehr_resource (resource_type, patient_id, tenant_id, status);

-- updated_at trigger (reuse function from migration 015).
CREATE TRIGGER ehr_resource_updated_at
  BEFORE UPDATE ON ehr_resource
  FOR EACH ROW
  EXECUTE FUNCTION ehr_update_updated_at();

-- Enable RLS.
ALTER TABLE ehr_resource ENABLE ROW LEVEL SECURITY;

-- RLS Policies.
-- SELECT: clinical roles with consent check for patient-scoped resources,
-- or role-based for non-patient-scoped resources.
CREATE POLICY ehr_resource_select ON ehr_resource
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = current_setting('app.tenant_id')::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
        'physician', 'nurse', 'pharmacist', 'medicalAssistant',
        'technician', 'therapist', 'socialWorker', 'careCoordinator',
        'complianceOfficer', 'healthInformationManager', 'systemAdmin'
      )
      AND (
        patient_id IS NULL
        OR ehr_patient_has_consent(patient_id, tenant_id, 'minimal')
        OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
        OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
          'complianceOfficer', 'healthInformationManager', 'systemAdmin'
        )
      )
    )
  );

-- INSERT: clinical roles that create resources.
CREATE POLICY ehr_resource_insert ON ehr_resource
  FOR INSERT TO PUBLIC
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id')::uuid
    AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
      'physician', 'nurse', 'pharmacist', 'medicalAssistant',
      'technician', 'therapist', 'socialWorker', 'careCoordinator',
      'healthInformationManager', 'systemAdmin'
    )
  );

-- UPDATE: clinical roles with consent check.
CREATE POLICY ehr_resource_update ON ehr_resource
  FOR UPDATE TO PUBLIC
  USING (
    tenant_id = current_setting('app.tenant_id')::uuid
    AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
      'physician', 'nurse', 'pharmacist', 'medicalAssistant',
      'technician', 'therapist', 'socialWorker', 'careCoordinator',
      'healthInformationManager', 'systemAdmin'
    )
    AND (
      patient_id IS NULL
      OR ehr_patient_has_consent(patient_id, tenant_id, 'minimal')
      OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
      OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
        'complianceOfficer', 'healthInformationManager', 'systemAdmin'
      )
    )
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id')::uuid
    AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
      'physician', 'nurse', 'pharmacist', 'medicalAssistant',
      'technician', 'therapist', 'socialWorker', 'careCoordinator',
      'healthInformationManager', 'systemAdmin'
    )
  );

-- DELETE: only systemAdmin.
CREATE POLICY ehr_resource_delete ON ehr_resource
  FOR DELETE TO PUBLIC
  USING (
    tenant_id = current_setting('app.tenant_id')::uuid
    AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
  );

-- ehr_resource_history: version history for all FHIR resources (both generic and dedicated tables).
-- This enables the _history endpoint for every resource type.
CREATE TABLE IF NOT EXISTS ehr_resource_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  version_id TEXT NOT NULL,
  fhir_resource JSONB NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ehr_resource_history_tenant ON ehr_resource_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_resource_history_resource ON ehr_resource_history (resource_type, resource_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_resource_history_created ON ehr_resource_history (created_at DESC);

-- History table is append-only: INSERT only, no UPDATE/DELETE via RLS.
ALTER TABLE ehr_resource_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY ehr_resource_history_select ON ehr_resource_history
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = current_setting('app.tenant_id')::uuid
    AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
      'physician', 'nurse', 'pharmacist', 'medicalAssistant',
      'technician', 'therapist', 'socialWorker', 'careCoordinator',
      'complianceOfficer', 'healthInformationManager', 'systemAdmin'
    )
  );

CREATE POLICY ehr_resource_history_insert ON ehr_resource_history
  FOR INSERT TO PUBLIC
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id')::uuid
    AND current_setting('request.jwt.claims', true)::jsonb->>'role' IS NOT NULL
  );
