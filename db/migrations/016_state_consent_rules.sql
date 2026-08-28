-- Migration 016: State Consent Rules Engine (F3.3 / PIX-4415)
-- Versioned, configurable state-by-state consent rules with legal review workflow
-- Tables: ehr_state_consent_rules (versioned rules) + ehr_state_consent_rules_audit (immutable audit log)
-- State machine: draft -> review -> approved -> active -> superseded/archived

-- =============================================================================
-- Main table: versioned state consent rules
-- =============================================================================
CREATE TABLE IF NOT EXISTS ehr_state_consent_rules (
    rule_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID,           -- NULL = global/default rules, non-NULL = tenant-specific override
    state_code       TEXT NOT NULL,  -- 2-letter US state/territory code (uppercase), e.g. 'CA', 'NY', 'DC', 'PR'
    version          INTEGER NOT NULL, -- auto-incrementing per (COALESCE(tenant_id), state_code)
    status           TEXT NOT NULL DEFAULT 'draft', -- draft, review, approved, active, superseded, archived
    rule_config      JSONB NOT NULL, -- the actual consent rules configuration (validated by Zod in app layer)
    created_by       UUID,           -- actor who created this version
    created_by_role  TEXT,
    reviewed_by      UUID,           -- actor who submitted for review / reviewed
    reviewed_by_role TEXT,
    reviewed_at      TIMESTAMPTZ,
    approved_by      UUID,           -- actor who approved
    approved_by_role TEXT,
    approved_at      TIMESTAMPTZ,
    activated_at     TIMESTAMPTZ,    -- when the rule was activated
    superseded_by    UUID,           -- FK to rule_id that superseded this one (self-referential)
    effective_date   DATE,           -- when the rule becomes effective
    expiry_date      DATE,           -- when the rule expires (NULL = no expiry)
    notes            TEXT,           -- reviewer/approver notes
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_state_consent_rules_superseded_by
        FOREIGN KEY (superseded_by) REFERENCES ehr_state_consent_rules(rule_id) ON DELETE SET NULL,
    CONSTRAINT chk_state_consent_rules_status CHECK (
        status IN ('draft', 'review', 'approved', 'active', 'superseded', 'archived')
    ),
    CONSTRAINT chk_state_consent_rules_version CHECK (version >= 1),
    CONSTRAINT chk_state_consent_rules_state_code CHECK (
        state_code = UPPER(state_code) AND length(state_code) = 2
    )
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Unique version per (COALESCE(tenant_id), state_code) — uses zero UUID for NULL tenant_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_version
    ON ehr_state_consent_rules (
        COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
        state_code,
        version
    );

-- Only one active version per (COALESCE(tenant_id), state_code)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_active
    ON ehr_state_consent_rules (
        COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
        state_code
    )
    WHERE status = 'active';

-- Common query patterns
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_tenant_state
    ON ehr_state_consent_rules (tenant_id, state_code, status);
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_state_status
    ON ehr_state_consent_rules (state_code, status);
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_status
    ON ehr_state_consent_rules (status);
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_created_by
    ON ehr_state_consent_rules (created_by, created_at DESC);

-- GIN index on rule_config for JSONB queries
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_config_gin
    ON ehr_state_consent_rules USING GIN (rule_config);

-- =============================================================================
-- Updated at trigger (uses shared ehr_update_updated_at() from migration 015)
-- =============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ehr_state_consent_rules_updated_at') THEN
        CREATE TRIGGER ehr_state_consent_rules_updated_at
            BEFORE UPDATE ON ehr_state_consent_rules
            FOR EACH ROW EXECUTE FUNCTION ehr_update_updated_at();
    END IF;
END $$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
ALTER TABLE ehr_state_consent_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: compliance/HIM/systemAdmin see all; other roles see only active rules
CREATE POLICY ehr_state_consent_rules_select ON ehr_state_consent_rules FOR SELECT
    USING (
        current_setting('request.jwt.claims', true)::jsonb->>'role'
            IN ('complianceOfficer', 'healthInformationManager', 'systemAdmin')
        OR status = 'active'
    );

-- INSERT: compliance officers, health information managers, system admins
CREATE POLICY ehr_state_consent_rules_insert ON ehr_state_consent_rules FOR INSERT
    WITH CHECK (
        current_setting('request.jwt.claims', true)::jsonb->>'role'
            IN ('complianceOfficer', 'healthInformationManager', 'systemAdmin')
    );

-- UPDATE: compliance officers, health information managers, system admins
CREATE POLICY ehr_state_consent_rules_update ON ehr_state_consent_rules FOR UPDATE
    USING (
        current_setting('request.jwt.claims', true)::jsonb->>'role'
            IN ('complianceOfficer', 'healthInformationManager', 'systemAdmin')
    )
    WITH CHECK (
        current_setting('request.jwt.claims', true)::jsonb->>'role'
            IN ('complianceOfficer', 'healthInformationManager', 'systemAdmin')
    );

-- DELETE: system admins only
CREATE POLICY ehr_state_consent_rules_delete ON ehr_state_consent_rules FOR DELETE
    USING (
        current_setting('request.jwt.claims', true)::jsonb->>'role' = 'systemAdmin'
    );

-- =============================================================================
-- Audit table: immutable log of all state consent rule changes
-- =============================================================================
CREATE TABLE IF NOT EXISTS ehr_state_consent_rules_audit (
    audit_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id      UUID,           -- nullable so ON DELETE SET NULL preserves audit entries when rules are deleted
    tenant_id    UUID,
    state_code   TEXT NOT NULL,
    version      INTEGER NOT NULL,
    action       TEXT NOT NULL, -- create, update, submit_for_review, approve, activate, supersede, archive, delete
    actor_id     UUID NOT NULL,
    actor_role   TEXT,
    old_status   TEXT,
    new_status   TEXT,
    changes      JSONB,  -- diff of changes (old vs new config)
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_state_consent_rules_audit_rule_id
        FOREIGN KEY (rule_id) REFERENCES ehr_state_consent_rules(rule_id) ON DELETE SET NULL,
    CONSTRAINT chk_state_consent_rules_audit_action CHECK (
        action IN ('create', 'update', 'submit_for_review', 'approve', 'activate',
                    'supersede', 'archive', 'delete')
    )
);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_audit_rule_id
    ON ehr_state_consent_rules_audit (rule_id);
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_audit_state
    ON ehr_state_consent_rules_audit (state_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_audit_actor
    ON ehr_state_consent_rules_audit (actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_audit_action
    ON ehr_state_consent_rules_audit (action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ehr_state_consent_rules_audit_tenant
    ON ehr_state_consent_rules_audit (tenant_id, timestamp DESC);

-- RLS on audit table — immutable (no UPDATE or DELETE)
ALTER TABLE ehr_state_consent_rules_audit ENABLE ROW LEVEL SECURITY;

-- SELECT: compliance officers, health info managers, system admins only
CREATE POLICY ehr_state_consent_rules_audit_select ON ehr_state_consent_rules_audit FOR SELECT
    USING (
        current_setting('request.jwt.claims', true)::jsonb->>'role'
            IN ('complianceOfficer', 'healthInformationManager', 'systemAdmin')
    );

-- INSERT: actor_role must match JWT role (ensures audit entries are authentic)
CREATE POLICY ehr_state_consent_rules_audit_insert ON ehr_state_consent_rules_audit FOR INSERT
    WITH CHECK (
        actor_role = current_setting('request.jwt.claims', true)::jsonb->>'role'
    );

-- No UPDATE — immutable
CREATE POLICY ehr_state_consent_rules_audit_update ON ehr_state_consent_rules_audit FOR UPDATE
    USING (false) WITH CHECK (false);

-- No DELETE — immutable
CREATE POLICY ehr_state_consent_rules_audit_delete ON ehr_state_consent_rules_audit FOR DELETE
    USING (false);

-- =============================================================================
-- SQL function: get next version number for a state/tenant combination
-- =============================================================================
CREATE OR REPLACE FUNCTION ehr_get_next_rule_version(
    p_state_code TEXT,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    max_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) INTO max_version
    FROM ehr_state_consent_rules
    WHERE state_code = UPPER(p_state_code)
      AND (tenant_id = p_tenant_id OR (tenant_id IS NULL AND p_tenant_id IS NULL));
    RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- SQL function: get active state consent rules for a tenant and state
-- Tries tenant-specific rules first, falls back to global (NULL tenant) rules
-- =============================================================================
CREATE OR REPLACE FUNCTION ehr_get_active_state_consent_rules(
    p_state_code TEXT,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    rule_id UUID,
    tenant_id UUID,
    state_code TEXT,
    version INTEGER,
    rule_config JSONB,
    effective_date DATE,
    expiry_date DATE
) AS $$
DECLARE
    tenant_rule RECORD;
    global_rule RECORD;
BEGIN
    -- First try tenant-specific active rule
    SELECT * INTO tenant_rule
    FROM ehr_state_consent_rules
    WHERE state_code = UPPER(p_state_code)
      AND tenant_id = p_tenant_id
      AND status = 'active'
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    ORDER BY version DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT
            tenant_rule.rule_id,
            tenant_rule.tenant_id,
            tenant_rule.state_code,
            tenant_rule.version,
            tenant_rule.rule_config,
            tenant_rule.effective_date,
            tenant_rule.expiry_date;
        RETURN;
    END IF;

    -- Fall back to global (NULL tenant) active rule
    SELECT * INTO global_rule
    FROM ehr_state_consent_rules
    WHERE state_code = UPPER(p_state_code)
      AND tenant_id IS NULL
      AND status = 'active'
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    ORDER BY version DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT
            global_rule.rule_id,
            global_rule.tenant_id,
            global_rule.state_code,
            global_rule.version,
            global_rule.rule_config,
            global_rule.effective_date,
            global_rule.expiry_date;
        RETURN;
    END IF;

    -- No active rule found — return empty result set
    RETURN;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
