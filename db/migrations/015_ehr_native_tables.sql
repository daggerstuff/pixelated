-- ============================================================================
-- Migration 015: EHR Native Tables
-- Description: 10 EHR native tables with FHIR JSONB storage, indexed search
--              columns, GIN indexes, and RLS policies with tenant isolation,
--              role-based access control, and consent-aware gating.
-- Dependencies: gen_random_uuid() (pgcrypto), available since migration 001.
-- ============================================================================

-- ============================================================================
-- Shared: updated_at trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION ehr_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ehr_practitioner
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_practitioner (
    practitioner_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    npi              TEXT,
    active           BOOLEAN     NOT NULL DEFAULT true,
    name             TEXT,
    fhir_resource    JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ehr_practitioner_tenant
    ON ehr_practitioner (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_practitioner_npi
    ON ehr_practitioner (npi) WHERE npi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_practitioner_active
    ON ehr_practitioner (tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_ehr_practitioner_fhir
    ON ehr_practitioner USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_practitioner_updated_at') THEN
        CREATE TRIGGER ehr_practitioner_updated_at
            BEFORE UPDATE ON ehr_practitioner
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

ALTER TABLE ehr_practitioner ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ehr_practitioner_select ON ehr_practitioner;
CREATE POLICY ehr_practitioner_select
    ON ehr_practitioner FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'pharmacist', 'medicalAssistant',
            'technician', 'therapist', 'socialWorker', 'careCoordinator',
            'frontDesk', 'billingSpecialist', 'complianceOfficer',
            'healthInformationManager', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_practitioner_insert ON ehr_practitioner;
CREATE POLICY ehr_practitioner_insert
    ON ehr_practitioner FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'healthInformationManager', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_practitioner_update ON ehr_practitioner;
CREATE POLICY ehr_practitioner_update
    ON ehr_practitioner FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'healthInformationManager', 'systemAdmin'
        )
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'healthInformationManager', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_practitioner_delete ON ehr_practitioner;
CREATE POLICY ehr_practitioner_delete
    ON ehr_practitioner FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
    );

-- ============================================================================
-- 2. ehr_patient
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_patient (
    patient_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    mrn              TEXT,
    active           BOOLEAN     NOT NULL DEFAULT true,
    family_name      TEXT,
    given_name       TEXT,
    birth_date       DATE,
    gender           TEXT,
    fhir_resource    JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ehr_patient_tenant
    ON ehr_patient (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_patient_mrn
    ON ehr_patient (tenant_id, mrn) WHERE mrn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_patient_active
    ON ehr_patient (tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_ehr_patient_name
    ON ehr_patient (tenant_id, family_name, given_name);
CREATE INDEX IF NOT EXISTS idx_ehr_patient_fhir
    ON ehr_patient USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_patient_updated_at') THEN
        CREATE TRIGGER ehr_patient_updated_at
            BEFORE UPDATE ON ehr_patient
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

-- ehr_patient RLS policies deferred until after ehr_patient_has_consent function
-- (see "ehr_patient RLS policies" section below)

-- ============================================================================
-- 3. ehr_consent
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_consent (
    consent_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    patient_id       UUID        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'active',
    scope            TEXT,
    category         TEXT,
    consent_level    TEXT        NOT NULL DEFAULT 'minimal',
    period_start     DATE,
    period_end       DATE,
    fhir_resource    JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ehr_consent_tenant
    ON ehr_consent (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_consent_patient
    ON ehr_consent (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ehr_consent_status
    ON ehr_consent (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ehr_consent_level
    ON ehr_consent (tenant_id, consent_level);
CREATE INDEX IF NOT EXISTS idx_ehr_consent_fhir
    ON ehr_consent USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_consent_updated_at') THEN
        CREATE TRIGGER ehr_consent_updated_at
            BEFORE UPDATE ON ehr_consent
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

ALTER TABLE ehr_consent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ehr_consent_select ON ehr_consent;
CREATE POLICY ehr_consent_select
    ON ehr_consent FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'careCoordinator', 'complianceOfficer',
            'healthInformationManager', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_consent_insert ON ehr_consent;
CREATE POLICY ehr_consent_insert
    ON ehr_consent FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'careCoordinator', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_consent_update ON ehr_consent;
CREATE POLICY ehr_consent_update
    ON ehr_consent FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'careCoordinator', 'complianceOfficer',
            'systemAdmin'
        )
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'careCoordinator', 'complianceOfficer',
            'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_consent_delete ON ehr_consent;
CREATE POLICY ehr_consent_delete
    ON ehr_consent FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'complianceOfficer', 'systemAdmin'
        )
    );

-- ============================================================================
-- Helper Function: Consent Check (created after ehr_consent table)
-- ============================================================================
CREATE OR REPLACE FUNCTION ehr_patient_has_consent(
    p_patient_id uuid,
    p_tenant_id uuid,
    p_min_level text DEFAULT 'minimal'
) RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM ehr_consent c
        WHERE c.patient_id = p_patient_id
          AND c.tenant_id = p_tenant_id
          AND c.status = 'active'
          AND (c.period_start IS NULL OR c.period_start <= CURRENT_DATE)
          AND (c.period_end IS NULL OR c.period_end >= CURRENT_DATE)
          AND (
              (p_min_level = 'none') OR
              (p_min_level = 'minimal' AND c.consent_level IN ('minimal', 'limited', 'full')) OR
              (p_min_level = 'limited' AND c.consent_level IN ('limited', 'full')) OR
              (p_min_level = 'full' AND c.consent_level = 'full')
          )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- 2b. ehr_patient RLS policies (deferred from section 2 — requires ehr_patient_has_consent)
-- ============================================================================
ALTER TABLE ehr_patient ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ehr_patient_select ON ehr_patient;
CREATE POLICY ehr_patient_select
    ON ehr_patient FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'pharmacist', 'medicalAssistant',
            'technician', 'therapist', 'socialWorker', 'careCoordinator',
            'frontDesk', 'billingSpecialist', 'complianceOfficer',
            'healthInformationManager', 'systemAdmin'
        )
        AND (
            ehr_patient_has_consent(patient_id, tenant_id, 'minimal')
            OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
            OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
                'complianceOfficer', 'systemAdmin'
            )
        )
    );

DROP POLICY IF EXISTS ehr_patient_insert ON ehr_patient;
CREATE POLICY ehr_patient_insert
    ON ehr_patient FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'frontDesk', 'healthInformationManager', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_patient_update ON ehr_patient;
CREATE POLICY ehr_patient_update
    ON ehr_patient FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'healthInformationManager', 'systemAdmin'
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
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'healthInformationManager', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_patient_delete ON ehr_patient;
CREATE POLICY ehr_patient_delete
    ON ehr_patient FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
    );

-- ============================================================================
-- 4. ehr_encounter
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_encounter (
    encounter_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    patient_id       UUID        NOT NULL,
    practitioner_id  UUID,
    status           TEXT        NOT NULL DEFAULT 'planned',
    class            TEXT,
    period_start     TIMESTAMPTZ,
    period_end       TIMESTAMPTZ,
    fhir_resource    JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
,
    CONSTRAINT fk_ehr_encounter_patient
        FOREIGN KEY (patient_id)
            REFERENCES ehr_patient (patient_id)
            ON DELETE RESTRICT,
    CONSTRAINT fk_ehr_encounter_practitioner
        FOREIGN KEY (practitioner_id)
            REFERENCES ehr_practitioner (practitioner_id)
            ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ehr_encounter_tenant
    ON ehr_encounter (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_encounter_patient
    ON ehr_encounter (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ehr_encounter_practitioner
    ON ehr_encounter (tenant_id, practitioner_id) WHERE practitioner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_encounter_status
    ON ehr_encounter (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ehr_encounter_period
    ON ehr_encounter (tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_encounter_fhir
    ON ehr_encounter USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_encounter_updated_at') THEN
        CREATE TRIGGER ehr_encounter_updated_at
            BEFORE UPDATE ON ehr_encounter
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

ALTER TABLE ehr_encounter ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ehr_encounter_select ON ehr_encounter;
CREATE POLICY ehr_encounter_select
    ON ehr_encounter FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'pharmacist', 'medicalAssistant',
            'technician', 'therapist', 'socialWorker', 'careCoordinator',
            'billingSpecialist', 'complianceOfficer', 'healthInformationManager',
            'systemAdmin'
        )
        AND (
            ehr_patient_has_consent(patient_id, tenant_id, 'minimal')
            OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
            OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
                'complianceOfficer', 'systemAdmin'
            )
        )
    );

DROP POLICY IF EXISTS ehr_encounter_insert ON ehr_encounter;
CREATE POLICY ehr_encounter_insert
    ON ehr_encounter FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_encounter_update ON ehr_encounter;
CREATE POLICY ehr_encounter_update
    ON ehr_encounter FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'systemAdmin'
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
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_encounter_delete ON ehr_encounter;
CREATE POLICY ehr_encounter_delete
    ON ehr_encounter FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
    );

-- ============================================================================
-- 5. ehr_appointment
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_appointment (
    appointment_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    patient_id       UUID        NOT NULL,
    practitioner_id  UUID,
    status           TEXT        NOT NULL DEFAULT 'proposed',
    start_time       TIMESTAMPTZ NOT NULL,
    end_time         TIMESTAMPTZ,
    fhir_resource    JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
,
    CONSTRAINT fk_ehr_appointment_patient
        FOREIGN KEY (patient_id)
            REFERENCES ehr_patient (patient_id)
            ON DELETE RESTRICT,
    CONSTRAINT fk_ehr_appointment_practitioner
        FOREIGN KEY (practitioner_id)
            REFERENCES ehr_practitioner (practitioner_id)
            ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ehr_appointment_tenant
    ON ehr_appointment (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_appointment_patient
    ON ehr_appointment (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ehr_appointment_practitioner
    ON ehr_appointment (tenant_id, practitioner_id) WHERE practitioner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_appointment_status
    ON ehr_appointment (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ehr_appointment_start
    ON ehr_appointment (tenant_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_appointment_fhir
    ON ehr_appointment USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_appointment_updated_at') THEN
        CREATE TRIGGER ehr_appointment_updated_at
            BEFORE UPDATE ON ehr_appointment
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

ALTER TABLE ehr_appointment ENABLE ROW LEVEL SECURITY;

-- Appointments bypass consent checks (schedule management consent level = 'none')
DROP POLICY IF EXISTS ehr_appointment_select ON ehr_appointment;
CREATE POLICY ehr_appointment_select
    ON ehr_appointment FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'frontDesk', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_appointment_insert ON ehr_appointment;
CREATE POLICY ehr_appointment_insert
    ON ehr_appointment FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'frontDesk', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_appointment_update ON ehr_appointment;
CREATE POLICY ehr_appointment_update
    ON ehr_appointment FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'frontDesk', 'systemAdmin'
        )
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'medicalAssistant', 'careCoordinator',
            'frontDesk', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_appointment_delete ON ehr_appointment;
CREATE POLICY ehr_appointment_delete
    ON ehr_appointment FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'medicalAssistant', 'careCoordinator', 'frontDesk', 'systemAdmin'
        )
    );

-- ============================================================================
-- 6. ehr_document_reference
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_document_reference (
    document_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    patient_id       UUID        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'current',
    type             TEXT,
    created_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fhir_resource    JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
,
    CONSTRAINT fk_ehr_document_ref_patient
        FOREIGN KEY (patient_id)
            REFERENCES ehr_patient (patient_id)
            ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ehr_document_ref_tenant
    ON ehr_document_reference (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_document_ref_patient
    ON ehr_document_reference (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ehr_document_ref_status
    ON ehr_document_reference (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ehr_document_ref_type
    ON ehr_document_reference (tenant_id, type) WHERE type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_document_ref_created
    ON ehr_document_reference (tenant_id, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_document_ref_fhir
    ON ehr_document_reference USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_document_reference_updated_at') THEN
        CREATE TRIGGER ehr_document_reference_updated_at
            BEFORE UPDATE ON ehr_document_reference
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

ALTER TABLE ehr_document_reference ENABLE ROW LEVEL SECURITY;

-- Clinical notes require 'limited' consent level
DROP POLICY IF EXISTS ehr_document_reference_select ON ehr_document_reference;
CREATE POLICY ehr_document_reference_select
    ON ehr_document_reference FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'therapist', 'socialWorker',
            'careCoordinator', 'complianceOfficer', 'healthInformationManager',
            'systemAdmin'
        )
        AND (
            ehr_patient_has_consent(patient_id, tenant_id, 'limited')
            OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
            OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
                'complianceOfficer', 'systemAdmin'
            )
        )
    );

DROP POLICY IF EXISTS ehr_document_reference_insert ON ehr_document_reference;
CREATE POLICY ehr_document_reference_insert
    ON ehr_document_reference FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'therapist', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_document_reference_update ON ehr_document_reference;
CREATE POLICY ehr_document_reference_update
    ON ehr_document_reference FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'therapist', 'systemAdmin'
        )
        AND (
            ehr_patient_has_consent(patient_id, tenant_id, 'limited')
            OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
            OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
                'complianceOfficer', 'systemAdmin'
            )
        )
    )
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'therapist', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_document_reference_delete ON ehr_document_reference;
CREATE POLICY ehr_document_reference_delete
    ON ehr_document_reference FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
    );

-- ============================================================================
-- 7. ehr_observation
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_observation (
    observation_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    patient_id       UUID        NOT NULL,
    encounter_id     UUID,
    status           TEXT        NOT NULL DEFAULT 'final',
    code             TEXT,
    effective_date   TIMESTAMPTZ,
    fhir_resource    JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
,
    CONSTRAINT fk_ehr_observation_patient
        FOREIGN KEY (patient_id)
            REFERENCES ehr_patient (patient_id)
            ON DELETE RESTRICT,
    CONSTRAINT fk_ehr_observation_encounter
        FOREIGN KEY (encounter_id)
            REFERENCES ehr_encounter (encounter_id)
            ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ehr_observation_tenant
    ON ehr_observation (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_observation_patient
    ON ehr_observation (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ehr_observation_encounter
    ON ehr_observation (tenant_id, encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_observation_status
    ON ehr_observation (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ehr_observation_code
    ON ehr_observation (tenant_id, code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_observation_effective
    ON ehr_observation (tenant_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_observation_fhir
    ON ehr_observation USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_observation_updated_at') THEN
        CREATE TRIGGER ehr_observation_updated_at
            BEFORE UPDATE ON ehr_observation
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

ALTER TABLE ehr_observation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ehr_observation_select ON ehr_observation;
CREATE POLICY ehr_observation_select
    ON ehr_observation FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
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

DROP POLICY IF EXISTS ehr_observation_insert ON ehr_observation;
CREATE POLICY ehr_observation_insert
    ON ehr_observation FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'pharmacist', 'medicalAssistant',
            'technician', 'therapist', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_observation_update ON ehr_observation;
CREATE POLICY ehr_observation_update
    ON ehr_observation FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'pharmacist', 'medicalAssistant',
            'technician', 'therapist', 'systemAdmin'
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
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'pharmacist', 'medicalAssistant',
            'technician', 'therapist', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_observation_delete ON ehr_observation;
CREATE POLICY ehr_observation_delete
    ON ehr_observation FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
    );

-- ============================================================================
-- 8. ehr_claim
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_claim (
    claim_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    patient_id       UUID        NOT NULL,
    encounter_id     UUID,
    status           TEXT        NOT NULL DEFAULT 'active',
    total            NUMERIC(12, 2),
    created_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fhir_resource    JSONB       NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
,
    CONSTRAINT fk_ehr_claim_patient
        FOREIGN KEY (patient_id)
            REFERENCES ehr_patient (patient_id)
            ON DELETE RESTRICT,
    CONSTRAINT fk_ehr_claim_encounter
        FOREIGN KEY (encounter_id)
            REFERENCES ehr_encounter (encounter_id)
            ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ehr_claim_tenant
    ON ehr_claim (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_claim_patient
    ON ehr_claim (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ehr_claim_encounter
    ON ehr_claim (tenant_id, encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_claim_status
    ON ehr_claim (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ehr_claim_created
    ON ehr_claim (tenant_id, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_claim_fhir
    ON ehr_claim USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_claim_updated_at') THEN
        CREATE TRIGGER ehr_claim_updated_at
            BEFORE UPDATE ON ehr_claim
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

ALTER TABLE ehr_claim ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ehr_claim_select ON ehr_claim;
CREATE POLICY ehr_claim_select
    ON ehr_claim FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'billingSpecialist', 'careCoordinator', 'complianceOfficer',
            'healthInformationManager', 'systemAdmin'
        )
        AND (
            ehr_patient_has_consent(patient_id, tenant_id, 'minimal')
            OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
            OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
                'complianceOfficer', 'systemAdmin'
            )
        )
    );

DROP POLICY IF EXISTS ehr_claim_insert ON ehr_claim;
CREATE POLICY ehr_claim_insert
    ON ehr_claim FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'billingSpecialist', 'careCoordinator', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_claim_update ON ehr_claim;
CREATE POLICY ehr_claim_update
    ON ehr_claim FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'billingSpecialist', 'careCoordinator', 'systemAdmin'
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
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'billingSpecialist', 'careCoordinator', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_claim_delete ON ehr_claim;
CREATE POLICY ehr_claim_delete
    ON ehr_claim FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
    );

-- ============================================================================
-- 9. ehr_service_request
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_service_request (
    service_request_id UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID      NOT NULL,
    patient_id         UUID      NOT NULL,
    practitioner_id    UUID,
    status             TEXT      NOT NULL DEFAULT 'active',
    intent             TEXT      NOT NULL DEFAULT 'order',
    category           TEXT,
    code               TEXT,
    fhir_resource      JSONB     NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
,
    CONSTRAINT fk_ehr_service_request_patient
        FOREIGN KEY (patient_id)
            REFERENCES ehr_patient (patient_id)
            ON DELETE RESTRICT,
    CONSTRAINT fk_ehr_service_request_practitioner
        FOREIGN KEY (practitioner_id)
            REFERENCES ehr_practitioner (practitioner_id)
            ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ehr_service_request_tenant
    ON ehr_service_request (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_service_request_patient
    ON ehr_service_request (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_ehr_service_request_practitioner
    ON ehr_service_request (tenant_id, practitioner_id) WHERE practitioner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_service_request_status
    ON ehr_service_request (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ehr_service_request_intent
    ON ehr_service_request (tenant_id, intent);
CREATE INDEX IF NOT EXISTS idx_ehr_service_request_category
    ON ehr_service_request (tenant_id, category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_service_request_code
    ON ehr_service_request (tenant_id, code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ehr_service_request_fhir
    ON ehr_service_request USING GIN (fhir_resource);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_service_request_updated_at') THEN
        CREATE TRIGGER ehr_service_request_updated_at
            BEFORE UPDATE ON ehr_service_request
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

ALTER TABLE ehr_service_request ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ehr_service_request_select ON ehr_service_request;
CREATE POLICY ehr_service_request_select
    ON ehr_service_request FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'pharmacist', 'medicalAssistant',
            'technician', 'therapist', 'careCoordinator', 'complianceOfficer',
            'healthInformationManager', 'systemAdmin'
        )
        AND (
            ehr_patient_has_consent(patient_id, tenant_id, 'minimal')
            OR current_setting('request.jwt.claims', true)::jsonb->>'break_glass' = 'true'
            OR current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
                'complianceOfficer', 'systemAdmin'
            )
        )
    );

DROP POLICY IF EXISTS ehr_service_request_insert ON ehr_service_request;
CREATE POLICY ehr_service_request_insert
    ON ehr_service_request FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'careCoordinator', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_service_request_update ON ehr_service_request;
CREATE POLICY ehr_service_request_update
    ON ehr_service_request FOR UPDATE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'careCoordinator', 'systemAdmin'
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
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'physician', 'nurse', 'careCoordinator', 'systemAdmin'
        )
    );

DROP POLICY IF EXISTS ehr_service_request_delete ON ehr_service_request;
CREATE POLICY ehr_service_request_delete
    ON ehr_service_request FOR DELETE
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
    );

-- ============================================================================
-- 10. ehr_audit_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS ehr_audit_history (
    audit_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID        NOT NULL,
    resource_type    TEXT        NOT NULL,
    resource_id      UUID        NOT NULL,
    action           TEXT        NOT NULL,
    actor_id         UUID        NOT NULL,
    actor_role       TEXT,
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fhir_resource    JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ehr_audit_history_tenant
    ON ehr_audit_history (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ehr_audit_history_resource
    ON ehr_audit_history (tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_ehr_audit_history_action
    ON ehr_audit_history (tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_ehr_audit_history_actor
    ON ehr_audit_history (tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_ehr_audit_history_timestamp
    ON ehr_audit_history (tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_audit_history_fhir
    ON ehr_audit_history USING GIN (fhir_resource) WHERE fhir_resource IS NOT NULL;

-- No updated_at trigger — audit records are immutable (no updated_at column)

ALTER TABLE ehr_audit_history ENABLE ROW LEVEL SECURITY;

-- Read: compliance officer, health information manager, system admin only
DROP POLICY IF EXISTS ehr_audit_history_select ON ehr_audit_history;
CREATE POLICY ehr_audit_history_select
    ON ehr_audit_history FOR SELECT
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IN (
            'complianceOfficer', 'healthInformationManager', 'systemAdmin'
        )
    );

-- Write: all authenticated roles insert audit entries
DROP POLICY IF EXISTS ehr_audit_history_insert ON ehr_audit_history;
CREATE POLICY ehr_audit_history_insert
    ON ehr_audit_history FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.tenant_id')::uuid
        AND current_setting('request.jwt.claims', true)::jsonb->>'role' IS NOT NULL
        AND actor_role = current_setting('request.jwt.claims', true)::jsonb->>'role'
        AND (
            actor_id = (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
            OR current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
        )
    );

-- Update: deny — audit records are immutable
DROP POLICY IF EXISTS ehr_audit_history_update ON ehr_audit_history;
CREATE POLICY ehr_audit_history_update
    ON ehr_audit_history FOR UPDATE
    USING (false)
    WITH CHECK (false);

-- Delete: deny — audit records are immutable
DROP POLICY IF EXISTS ehr_audit_history_delete ON ehr_audit_history;
CREATE POLICY ehr_audit_history_delete
    ON ehr_audit_history FOR DELETE
    USING (false);
