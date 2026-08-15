-- ============================================================================
-- Pixelated Empathy — Database Schema v1
-- Multi-tenant clinical simulation platform
-- PostgreSQL 15+ with Row-Level Security
-- Zero-PHI by design
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS pe;

-- ============================================================================
-- 2. CUSTOM TYPES
-- ============================================================================
CREATE TYPE pe.user_role AS ENUM (
    'super_admin',      -- Global system admin
    'institution_admin', -- Tenant-level admin
    'manager',          -- Scenario/persona management
    'educator',         -- Run simulations, view results
    'learner'           -- Participate in simulations
);

CREATE TYPE pe.simulation_status AS ENUM (
    'pending',      -- Created but not started
    'active',       -- Simulation in progress
    'paused',       -- Temporarily paused
    'completed',    -- Successfully finished
    'aborted',      -- Terminated by admin/error
    'archived'      -- Retired from active view
);

CREATE TYPE pe.persona_type AS ENUM (
    'patient',      -- Simulated patient
    'family',       -- Family member
    'colleague',    -- Healthcare colleague
    'attending',    -- Senior clinician
    'narrator'      -- Scenario narrator / facilitator
);

CREATE TYPE pe.metering_event_type AS ENUM (
    'seat_assigned',
    'seat_revoked',
    'simulation_started',
    'simulation_hour_bucket',
    'inference_token_used'
);

CREATE TYPE pe.audit_action AS ENUM (
    'user.login',
    'user.logout',
    'user.created',
    'user.deactivated',
    'user.role_changed',
    'simulation.created',
    'simulation.started',
    'simulation.completed',
    'simulation.aborted',
    'persona.created',
    'persona.updated',
    'persona.deleted',
    'scenario.created',
    'scenario.updated',
    'scenario.deleted',
    'tenant.config_updated',
    'metering.rollup',
    'phi_guard.alert',
    'admin.action'
);

-- ============================================================================
-- 3. TENANT / INSTITUTION TABLES
-- ============================================================================

-- 3a. Institutions (tenants)
CREATE TABLE pe.institutions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,       -- URL-friendly identifier
    institution_type VARCHAR(50) NOT NULL               -- 'medical_school', 'nursing_program', 'teaching_hospital', etc.
        CHECK (institution_type IN ('medical_school', 'nursing_program', 'teaching_hospital', 'residency_program', 'allied_health')),

    -- Billing / subscription
    subscription_tier   VARCHAR(50) NOT NULL DEFAULT 'starter'
        CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
    max_seats       INTEGER NOT NULL DEFAULT 10,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    -- Encryption / compliance metadata
    encryption_key_id   VARCHAR(255),                  -- Reference to KMS key for this tenant
    data_region     VARCHAR(50) NOT NULL DEFAULT 'us-east-1',

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3b. Institution settings (feature flags, config)
CREATE TABLE pe.institution_settings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES pe.institutions(id) ON DELETE CASCADE,
    setting_key         VARCHAR(255) NOT NULL,
    setting_value       JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, setting_key)
);

-- ============================================================================
-- 4. USER / AUTHENTICATION TABLES
-- ============================================================================

-- 4a. Users (can belong to one institution)
CREATE TABLE pe.users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES pe.institutions(id),

    -- Identity (encrypted at application layer)
    email_ciphertext    BYTEA NOT NULL,                -- pgp_sym_encrypt(email)
    email_hash          VARCHAR(64) NOT NULL UNIQUE,   -- SHA-256 for uniqueness lookups (not PHI)
    display_name        VARCHAR(255) NOT NULL,

    -- Authentication
    password_hash       VARCHAR(255) NOT NULL,          -- bcrypt
    refresh_token_hash  VARCHAR(255),                   -- SHA-256 of current refresh token

    -- Role / Authorization
    role                pe.user_role NOT NULL DEFAULT 'learner',

    -- Status
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at       TIMESTAMPTZ,
    last_active_at      TIMESTAMPTZ,

    -- Metadata
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_user_institution
        FOREIGN KEY (institution_id) REFERENCES pe.institutions(id)
);

-- 4b. API Keys (for programmatic access / Celery workers)
CREATE TABLE pe.api_keys (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES pe.institutions(id),
    key_prefix          VARCHAR(8) NOT NULL,            -- First 8 chars of key (for identification)
    key_hash            VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 of full key
    label               VARCHAR(255),
    role                pe.user_role NOT NULL DEFAULT 'manager',
    expires_at          TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at        TIMESTAMPTZ,
    created_by          UUID NOT NULL REFERENCES pe.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4c. Login attempts (rate limiting / security)
CREATE TABLE pe.login_attempts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_hash          VARCHAR(64) NOT NULL,
    ip_address          INET NOT NULL,
    success             BOOLEAN NOT NULL,
    attempted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email ON pe.login_attempts(email_hash, attempted_at);
CREATE INDEX idx_login_attempts_ip ON pe.login_attempts(ip_address, attempted_at);

-- ============================================================================
-- 5. SIMULATION TABLES
-- ============================================================================

-- 5a. Scenarios (template definitions)
CREATE TABLE pe.scenarios (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES pe.institutions(id),
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    clinical_focus      VARCHAR(100),                   -- 'cardiology', 'emergency', 'pediatrics', etc.
    difficulty_level    VARCHAR(20) NOT NULL DEFAULT 'intermediate'
        CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    expected_duration_minutes INTEGER,

    -- Persona configuration (JSON — defines which personas participate)
    persona_config      JSONB NOT NULL DEFAULT '[]',

    -- Safety / accuracy
    accuracy_rules      JSONB,                          -- Expected clinical decisions, guardrails
    accuracy_pass_threshold DECIMAL(5,2) DEFAULT 80.00, -- Percentage to pass

    -- Status
    is_published        BOOLEAN NOT NULL DEFAULT FALSE,
    version             INTEGER NOT NULL DEFAULT 1,
    created_by          UUID NOT NULL REFERENCES pe.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5b. Simulation Sessions (runtime instances)
CREATE TABLE pe.simulation_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES pe.institutions(id),
    scenario_id         UUID NOT NULL REFERENCES pe.scenarios(id),

    -- Participants
    educator_id         UUID REFERENCES pe.users(id),   -- The educator running the session
    learner_id          UUID NOT NULL REFERENCES pe.users(id),

    -- Status & timing
    status              pe.simulation_status NOT NULL DEFAULT 'pending',
    started_at          TIMESTAMPTZ,
    paused_at           TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    total_pause_seconds INTEGER NOT NULL DEFAULT 0,     -- Accumulated pause time

    -- Results
    accuracy_score      DECIMAL(5,2),
    accuracy_breakdown  JSONB,                          -- Per-metric scores
    completed           BOOLEAN NOT NULL DEFAULT FALSE,

    -- Safety monitor
    safety_violations   INTEGER NOT NULL DEFAULT 0,
    safety_log          JSONB DEFAULT '[]',              -- Array of safety events

    -- Metadata
    session_context     JSONB DEFAULT '{}',              -- Scenario-specific state
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5c. Simulation Messages (conversation turns)
CREATE TABLE pe.simulation_messages (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES pe.simulation_sessions(id),
    institution_id      UUID NOT NULL,

    -- Origin
    actor_type          VARCHAR(20) NOT NULL             -- 'learner', 'persona', 'system'
        CHECK (actor_type IN ('learner', 'persona', 'system')),
    actor_id            UUID,                            -- persona_instance_id or user_id
    persona_instance_id UUID,                            -- If from a persona

    -- Content (zero-PHI checked)
    message_text        TEXT NOT NULL,
    message_metadata    JSONB DEFAULT '{}',              -- intent, sentiment, etc.

    -- Safety check
    safety_checked      BOOLEAN NOT NULL DEFAULT FALSE,
    safety_flagged      BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timing
    turn_number         INTEGER NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sim_messages_session ON pe.simulation_messages(session_id, turn_number);

-- 5d. Persona Definitions (templates)
CREATE TABLE pe.persona_definitions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID REFERENCES pe.institutions(id),  -- NULL = system global
    name                VARCHAR(255) NOT NULL,
    persona_type        pe.persona_type NOT NULL,

    -- Clinical personality
    age                 INTEGER,
    gender              VARCHAR(50),
    background          TEXT,                               -- Clinical history narrative
    personality_traits  JSONB DEFAULT '{}',                  -- Big Five / communication style
    clinical_conditions JSONB DEFAULT '[]',                  -- Medical conditions this persona simulates

    -- LLM behavior
    system_prompt       TEXT NOT NULL,
    temperature         DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    max_tokens          INTEGER NOT NULL DEFAULT 512,

    -- Status
    is_global           BOOLEAN NOT NULL DEFAULT FALSE,      -- Global personas available to all tenants
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    version             INTEGER NOT NULL DEFAULT 1,
    created_by          UUID REFERENCES pe.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5e. Persona Instances (runtime copies)
CREATE TABLE pe.persona_instances (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES pe.simulation_sessions(id),
    persona_definition_id UUID NOT NULL REFERENCES pe.persona_definitions(id),
    institution_id      UUID NOT NULL,

    -- Runtime state
    current_state       JSONB NOT NULL DEFAULT '{}',        -- Emotional state, knowledge state, etc.
    conversation_history JSONB NOT NULL DEFAULT '[]',       -- Truncated context window
    turn_count          INTEGER NOT NULL DEFAULT 0,
    tokens_consumed     INTEGER NOT NULL DEFAULT 0,

    -- Status
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. METERING TABLES
-- ============================================================================

-- 6a. Metering Events (raw, append-only source of truth)
CREATE TABLE pe.metering_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES pe.institutions(id),
    event_type          pe.metering_event_type NOT NULL,
    idempotency_key     VARCHAR(255) NOT NULL UNIQUE,       -- Prevents double-counting

    -- Event payload
    actor_id            UUID REFERENCES pe.users(id),
    session_id          UUID REFERENCES pe.simulation_sessions(id),
    quantity            DECIMAL(12,4) NOT NULL,             -- Hours, tokens, seat count
    unit                VARCHAR(20) NOT NULL,               -- 'hours', 'tokens', 'seats'

    -- Metadata
    payload             JSONB DEFAULT '{}',
    source              VARCHAR(100) NOT NULL,              -- 'api', 'celery_checker', 'rollup_job'

    -- Timing
    event_timestamp     TIMESTAMPTZ NOT NULL,               -- When the event actually happened
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When we recorded it
    -- Staleness guard: events older than 24h are rejected by application
    CONSTRAINT chk_event_freshness CHECK (event_timestamp <= ingested_at AND ingested_at - event_timestamp < INTERVAL '24 hours')
);

CREATE INDEX idx_metering_institution ON pe.metering_events(institution_id, event_timestamp);

-- IMMUTABILITY ENFORCEMENT: Prevent UPDATE or DELETE on metering_events
CREATE OR REPLACE FUNCTION pe.prevent_metering_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Metering events are immutable: UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_metering_update
    BEFORE UPDATE ON pe.metering_events
    FOR EACH ROW
    EXECUTE FUNCTION pe.prevent_metering_mutation();

CREATE TRIGGER trg_prevent_metering_delete
    BEFORE DELETE ON pe.metering_events
    FOR EACH ROW
    EXECUTE FUNCTION pe.prevent_metering_mutation();
CREATE INDEX idx_metering_type ON pe.metering_events(event_type, event_timestamp);

-- 6b. Metering Daily Rollups (pre-aggregated for billing)
CREATE TABLE pe.metering_daily_rollups (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES pe.institutions(id),
    rollup_date         DATE NOT NULL,

    -- Seat metrics
    active_seats        INTEGER NOT NULL DEFAULT 0,         -- Max concurrent active users that day
    peak_seats          INTEGER NOT NULL DEFAULT 0,

    -- Simulation metrics
    simulation_hours    DECIMAL(12,4) NOT NULL DEFAULT 0,   -- Total hours across all sessions
    session_count       INTEGER NOT NULL DEFAULT 0,

    -- Token metrics
    total_tokens_input  BIGINT NOT NULL DEFAULT 0,
    total_tokens_output BIGINT NOT NULL DEFAULT 0,
    total_tokens        BIGINT NOT NULL DEFAULT 0,

    -- Computed at
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, rollup_date)
);

-- 6c. Billing Periods (invoice cycles)
CREATE TABLE pe.billing_periods (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID NOT NULL REFERENCES pe.institutions(id),
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,

    -- Computed usage
    total_active_seats  INTEGER NOT NULL DEFAULT 0,         -- Average seats over period
    total_simulation_hours DECIMAL(12,4) NOT NULL DEFAULT 0,
    total_tokens        BIGINT NOT NULL DEFAULT 0,

    -- Billing
    amount_due          DECIMAL(12,2) NOT NULL DEFAULT 0,   -- In cents or base unit
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    invoice_status      VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (invoice_status IN ('pending', 'issued', 'paid', 'overdue', 'cancelled')),
    invoice_url         VARCHAR(500),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, period_start)
);

-- ============================================================================
-- 7. AUDIT LOG (Immutable — INSERT only)
-- ============================================================================
CREATE TABLE pe.audit_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES pe.institutions(id),
    actor_id            UUID,                               -- NULL for system actions
    actor_role          pe.user_role,

    action              pe.audit_action NOT NULL,
    resource_type       VARCHAR(100) NOT NULL,              -- 'user', 'simulation', 'scenario', etc.
    resource_id         UUID,

    payload             JSONB DEFAULT '{}',                  -- Action-specific details
    ip_address          INET,
    user_agent          TEXT,

    -- Cryptographic hash chain
    prev_hash           VARCHAR(64),                         -- SHA-256 of previous row
    row_hash            VARCHAR(64) NOT NULL,                -- SHA-256 of this row's content

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log hash chain trigger: compute prev_hash and row_hash
CREATE OR REPLACE FUNCTION pe.compute_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
    last_hash VARCHAR(64);
    row_content TEXT;
BEGIN
    -- Serialize chain-head selection to prevent hash chain forking
    PERFORM pg_advisory_xact_lock(hashtext('pe.audit_chain_head'));

    -- Get the hash of the last row
    SELECT row_hash INTO last_hash
    FROM pe.audit_log
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    NEW.prev_hash := last_hash;

    -- Build the content to hash
    row_content := COALESCE(NEW.tenant_id::text, '') || '|' ||
                   COALESCE(NEW.actor_id::text, '') || '|' ||
                   COALESCE(NEW.action::text, '') || '|' ||
                   COALESCE(NEW.resource_type, '') || '|' ||
                   COALESCE(NEW.resource_id::text, '') || '|' ||
                   COALESCE(NEW.payload::text, '{}') || '|' ||
                   COALESCE(NEW.ip_address::text, '') || '|' ||
                   COALESCE(NEW.user_agent, '') || '|' ||
                   COALESCE(last_hash, '') || '|' ||
                   COALESCE(NEW.created_at::text, '');

    NEW.row_hash := encode(
        digest(row_content, 'sha256'),
        'hex'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_hash
    BEFORE INSERT ON pe.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION pe.compute_audit_hash();

-- IMMUTABILITY ENFORCEMENT: Prevent UPDATE or DELETE on audit_log
CREATE OR REPLACE FUNCTION pe.prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log is immutable: UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_update
    BEFORE UPDATE ON pe.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION pe.prevent_audit_mutation();

CREATE TRIGGER trg_prevent_audit_delete
    BEFORE DELETE ON pe.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION pe.prevent_audit_mutation();

CREATE INDEX idx_audit_tenant ON pe.audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_actor ON pe.audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON pe.audit_log(action, created_at DESC);

-- ============================================================================
-- 8. PHI GUARD TABLES
-- ============================================================================

-- 8a. PHI Guard Events (recorded when PHI patterns are detected)
CREATE TABLE pe.phi_guard_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID REFERENCES pe.institutions(id),
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source              VARCHAR(100) NOT NULL,              -- 'input_middleware', 'output_middleware', 'cron_scan'
    endpoint            VARCHAR(500),
    phi_pattern         VARCHAR(50) NOT NULL,               -- 'ssn', 'email', 'phone', 'mrn'
    action_taken        VARCHAR(50) NOT NULL,               -- 'rejected', 'redacted', 'logged'
    actor_id            UUID REFERENCES pe.users(id),

    -- Store a sanitized description (NOT the PHI itself)
    context_description TEXT,                               -- e.g., "Input field 'patient_info' matched SSN pattern"
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8b. PHI Guard Allowlist (terms that look like PHI but are legitimate)
CREATE TABLE pe.phi_guard_allowlist (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id      UUID REFERENCES pe.institutions(id),
    pattern             VARCHAR(255) NOT NULL,              -- Exact regex or text match to allow
    reason              TEXT NOT NULL,                       -- Why this is legitimate
    created_by          UUID NOT NULL REFERENCES pe.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, pattern)
);

-- ============================================================================
-- 9. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

-- 9a. Helper function to get current tenant
CREATE OR REPLACE FUNCTION pe.current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.tenant_id')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9b. Helper: is the current user a super admin?
CREATE OR REPLACE FUNCTION pe.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('app.user_role') = 'super_admin';
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9c. Enable RLS on tenant-scoped tables
ALTER TABLE pe.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.institution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.simulation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.simulation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.persona_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.persona_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.metering_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.metering_daily_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.phi_guard_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pe.phi_guard_allowlist ENABLE ROW LEVEL SECURITY;

-- 9d. RLS policies — tenant isolation

-- Institutions: super_admins see all; users see only their own institution
CREATE POLICY tenant_isolation_institutions ON pe.institutions
    FOR ALL
    USING (
        pe.is_super_admin() OR id = pe.current_tenant_id()
    );

-- Tenant-scoped tables: filter by institution_id
-- (Applied generically; adjust per table if needed)
DO $$
DECLARE
    tbl text;
    tenant_col text;
BEGIN
    FOR tbl, tenant_col IN
        SELECT * FROM unnest(ARRAY[
            ('institution_settings', 'institution_id'),
            ('users', 'institution_id'),
            ('api_keys', 'institution_id'),
            ('scenarios', 'institution_id'),
            ('simulation_sessions', 'institution_id'),
            ('simulation_messages', 'institution_id'),
            ('persona_definitions', 'institution_id'),
            ('persona_instances', 'institution_id'),
            ('metering_events', 'institution_id'),
            ('metering_daily_rollups', 'institution_id'),
            ('billing_periods', 'institution_id'),
            ('audit_log', 'tenant_id'),
            ('phi_guard_events', 'institution_id'),
            ('phi_guard_allowlist', 'institution_id')
        ]::text[])
    LOOP
        EXECUTE format(
            'CREATE POLICY tenant_isolation_%s ON pe.%I FOR ALL USING (
                pe.is_super_admin() OR %I = pe.current_tenant_id()
            )',
            tbl, tbl, tenant_col
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Persona definitions: allow tenant users to read global personas
CREATE POLICY persona_global_read ON pe.persona_definitions
    FOR SELECT
    USING (
        pe.is_super_admin()
        OR institution_id = pe.current_tenant_id()
        OR (institution_id IS NULL AND is_global = TRUE)
    );

-- Users table: different policy — users can see their own row always
ALTER TABLE pe.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE pe.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_isolation ON pe.users
    FOR ALL
    USING (
        pe.is_super_admin()
        OR institution_id = pe.current_tenant_id()
        OR id = current_setting('app.user_id')::UUID
    );

-- ============================================================================
-- 10. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users
CREATE INDEX idx_users_institution ON pe.users(institution_id);
CREATE INDEX idx_users_role ON pe.users(role);
CREATE INDEX idx_users_email_hash ON pe.users(email_hash);

-- Scenarios
CREATE INDEX idx_scenarios_institution ON pe.scenarios(institution_id);
CREATE INDEX idx_scenarios_clinical ON pe.scenarios(clinical_focus);

-- Sessions
CREATE INDEX idx_sessions_institution ON pe.simulation_sessions(institution_id);
CREATE INDEX idx_sessions_learner ON pe.simulation_sessions(learner_id);
CREATE INDEX idx_sessions_educator ON pe.simulation_sessions(educator_id);
CREATE INDEX idx_sessions_status ON pe.simulation_sessions(status);
CREATE INDEX idx_sessions_created ON pe.simulation_sessions(created_at DESC);

-- Persona instances
CREATE INDEX idx_persona_session ON pe.persona_instances(session_id);

-- Metering
CREATE INDEX idx_metering_rollup_date ON pe.metering_daily_rollups(rollup_date DESC);
CREATE INDEX idx_billing_periods_institution ON pe.billing_periods(institution_id, period_start DESC);

-- ============================================================================
-- 11. APPLICATION-LEVEL FUNCTIONS
-- ============================================================================

-- 11a. Set session context from JWT (called on each API request)
CREATE OR REPLACE FUNCTION pe.set_session_context(
    p_tenant_id UUID,
    p_user_id UUID,
    p_user_role pe.user_role
)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::text, TRUE);
    PERFORM set_config('app.user_id', p_user_id::text, TRUE);
    PERFORM set_config('app.user_role', p_user_role::text, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION pe.set_session_context(UUID, UUID, pe.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pe.set_session_context(UUID, UUID, pe.user_role) TO pe_app_role;

-- 11b. Audit helper (called by application code)
CREATE OR REPLACE FUNCTION pe.log_audit_event(
    p_action pe.audit_action,
    p_resource_type VARCHAR,
    p_resource_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO pe.audit_log (
        tenant_id, actor_id, actor_role, action,
        resource_type, resource_id, payload,
        ip_address, user_agent
    ) VALUES (
        pe.current_tenant_id(),
        current_setting('app.user_id')::UUID,
        current_setting('app.user_role')::pe.user_role,
        p_action, p_resource_type, p_resource_id,
        p_payload, p_ip_address, p_user_agent
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11c. Metering event ingestion (idempotent)
CREATE OR REPLACE FUNCTION pe.ingest_metering_event(
    p_institution_id UUID,
    p_event_type pe.metering_event_type,
    p_idempotency_key VARCHAR,
    p_actor_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_quantity DECIMAL DEFAULT 0,
    p_unit VARCHAR DEFAULT NULL,
    p_payload JSONB DEFAULT '{}',
    p_source VARCHAR DEFAULT 'api',
    p_event_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO pe.metering_events (
        institution_id, event_type, idempotency_key,
        actor_id, session_id, quantity, unit,
        payload, source, event_timestamp
    ) VALUES (
        p_institution_id, p_event_type, p_idempotency_key,
        p_actor_id, p_session_id, p_quantity, p_unit,
        p_payload, p_source, p_event_timestamp
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION pe.ingest_metering_event(
    UUID, pe.metering_event_type, VARCHAR, UUID, UUID,
    DECIMAL, VARCHAR, JSONB, VARCHAR, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pe.ingest_metering_event(
    UUID, pe.metering_event_type, VARCHAR, UUID, UUID,
    DECIMAL, VARCHAR, JSONB, VARCHAR, TIMESTAMPTZ
) TO pe_app_role;

-- ============================================================================
-- 12. SEED DATA — Global System Personas
-- ============================================================================

-- Note: Institution seeding happens at tenant onboarding time via application code.
-- Here we seed global persona definitions available to all tenants.

INSERT INTO pe.persona_definitions (id, institution_id, name, persona_type, system_prompt, is_global, version) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Standard Patient (Adult)',
    'patient',
    'You are a cooperative adult patient presenting with clear symptoms. Answer questions directly and provide relevant clinical history when asked.',
    TRUE,
    1
),
(
    '00000000-0000-0000-0000-000000000002',
    NULL,
    'Elderly Patient (Confused)',
    'patient',
    'You are an elderly patient with mild confusion and some memory issues. You struggle to remember details but try your best to help the clinician.',
    TRUE,
    1
),
(
    '00000000-0000-0000-0000-000000000003',
    NULL,
    'Concerned Family Member',
    'family',
    'You are an anxious family member worried about the patient. You ask many questions and need reassurance, but you are cooperative.',
    TRUE,
    1
),
(
    '00000000-0000-0000-0000-000000000004',
    NULL,
    'Neutral Clinical Narrator',
    'narrator',
    'You are a neutral clinical narrator. Present the scenario context and vitals. Do not offer diagnoses or guidance.',
    TRUE,
    1
);
