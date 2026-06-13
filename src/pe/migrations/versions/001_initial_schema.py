"""Initial schema — multi-tenant database for Pixelated Empathy.

Revision ID: 001
Revises: None
Create Date: 2025-06-08

This migration applies the full schema from schema-ddl-v1.sql:
- Extensions (pgcrypto, uuid-ossp)
- Custom types (user_role, simulation_status, persona_type, etc.)
- All tables (institutions, users, scenarios, sessions, personas, metering, audit, PHI guards)
- RLS policies for tenant isolation
- Immutable audit log with hash chain
- Indexes and application functions
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:  # noqa: PLR0915
    """Apply the initial database schema."""

    # ── Extensions ──────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ── Schema ──────────────────────────────────────────────────
    op.execute("CREATE SCHEMA IF NOT EXISTS pe")

    # ── Custom Types ────────────────────────────────────────────
    op.execute("""
        CREATE TYPE pe.user_role AS ENUM (
            'super_admin', 'institution_admin', 'manager', 'educator', 'learner'
        )
    """)
    op.execute("""
        CREATE TYPE pe.simulation_status AS ENUM (
            'pending', 'active', 'paused', 'completed', 'aborted', 'archived'
        )
    """)
    op.execute("""
        CREATE TYPE pe.persona_type AS ENUM (
            'patient', 'family', 'colleague', 'attending', 'narrator'
        )
    """)
    op.execute("""
        CREATE TYPE pe.metering_event_type AS ENUM (
            'seat_assigned', 'seat_revoked', 'simulation_started',
            'simulation_hour_bucket', 'inference_token_used'
        )
    """)
    op.execute("""
        CREATE TYPE pe.audit_action AS ENUM (
            'user.login', 'user.logout', 'user.created', 'user.deactivated',
            'user.role_changed', 'simulation.created', 'simulation.started',
            'simulation.completed', 'simulation.aborted', 'persona.created',
            'persona.updated', 'persona.deleted', 'scenario.created',
            'scenario.updated', 'scenario.deleted', 'tenant.config_updated',
            'metering.rollup', 'phi_guard.alert', 'admin.action'
        )
    """)

    # ── Institutions ────────────────────────────────────────────
    op.create_table(
        "institutions",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("name", sa.VARCHAR(255), nullable=False),
        sa.Column("slug", sa.VARCHAR(100), nullable=False),
        sa.Column("institution_type", sa.VARCHAR(50), nullable=False),
        sa.Column("subscription_tier", sa.VARCHAR(50), server_default="starter", nullable=False),
        sa.Column("max_seats", sa.INTEGER(), server_default="10", nullable=False),
        sa.Column("is_active", sa.BOOLEAN(), server_default="true", nullable=False),
        sa.Column("encryption_key_id", sa.VARCHAR(255), nullable=True),
        sa.Column("data_region", sa.VARCHAR(50), server_default="us-east-1", nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
        schema="pe",
    )

    # ── Institution Settings ────────────────────────────────────
    op.create_table(
        "institution_settings",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("setting_key", sa.VARCHAR(255), nullable=False),
        sa.Column("setting_value", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("institution_id", "setting_key"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"], ondelete="CASCADE"),
        schema="pe",
    )

    # ── Users ───────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("email_ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("email_hash", sa.VARCHAR(64), nullable=False),
        sa.Column("display_name", sa.VARCHAR(255), nullable=False),
        sa.Column("password_hash", sa.VARCHAR(255), nullable=False),
        sa.Column("refresh_token_hash", sa.VARCHAR(255), nullable=True),
        sa.Column("role", sa.VARCHAR(50), server_default="learner", nullable=False),
        sa.Column("is_active", sa.BOOLEAN(), server_default="true", nullable=False),
        sa.Column("last_login_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_active_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email_hash"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        schema="pe",
    )

    # ── API Keys ────────────────────────────────────────────────
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("key_prefix", sa.VARCHAR(8), nullable=False),
        sa.Column("key_hash", sa.VARCHAR(255), nullable=False),
        sa.Column("label", sa.VARCHAR(255), nullable=True),
        sa.Column("role", sa.VARCHAR(50), server_default="manager", nullable=False),
        sa.Column("expires_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("is_active", sa.BOOLEAN(), server_default="true", nullable=False),
        sa.Column("last_used_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_hash"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["pe.users.id"]),
        schema="pe",
    )

    # ── Scenarios ───────────────────────────────────────────────
    op.create_table(
        "scenarios",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("title", sa.VARCHAR(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("clinical_focus", sa.VARCHAR(100), nullable=True),
        sa.Column("difficulty_level", sa.VARCHAR(20), server_default="intermediate", nullable=False),
        sa.Column("expected_duration_minutes", sa.INTEGER(), nullable=True),
        sa.Column("persona_config", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("accuracy_rules", postgresql.JSONB(), nullable=True),
        sa.Column("accuracy_pass_threshold", sa.DECIMAL(5, 2), server_default="80.00", nullable=True),
        sa.Column("is_published", sa.BOOLEAN(), server_default="false", nullable=False),
        sa.Column("version", sa.INTEGER(), server_default="1", nullable=False),
        sa.Column("created_by", postgresql.UUID(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["pe.users.id"]),
        schema="pe",
    )

    # ── Simulation Sessions ─────────────────────────────────────
    op.create_table(
        "simulation_sessions",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("scenario_id", postgresql.UUID(), nullable=False),
        sa.Column("educator_id", postgresql.UUID(), nullable=True),
        sa.Column("learner_id", postgresql.UUID(), nullable=False),
        sa.Column("status", sa.VARCHAR(50), server_default="pending", nullable=False),
        sa.Column("started_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("paused_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("completed_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("total_pause_seconds", sa.INTEGER(), server_default="0", nullable=False),
        sa.Column("accuracy_score", sa.DECIMAL(5, 2), nullable=True),
        sa.Column("accuracy_breakdown", postgresql.JSONB(), nullable=True),
        sa.Column("completed", sa.BOOLEAN(), server_default="false", nullable=False),
        sa.Column("safety_violations", sa.INTEGER(), server_default="0", nullable=False),
        sa.Column("safety_log", postgresql.JSONB(), server_default="[]", nullable=True),
        sa.Column("session_context", postgresql.JSONB(), server_default="{}", nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        sa.ForeignKeyConstraint(["scenario_id"], ["pe.scenarios.id"]),
        sa.ForeignKeyConstraint(["educator_id"], ["pe.users.id"]),
        sa.ForeignKeyConstraint(["learner_id"], ["pe.users.id"]),
        schema="pe",
    )

    # ── Simulation Messages ─────────────────────────────────────
    op.create_table(
        "simulation_messages",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("session_id", postgresql.UUID(), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("actor_type", sa.VARCHAR(20), nullable=False),
        sa.Column("actor_id", postgresql.UUID(), nullable=True),
        sa.Column("persona_instance_id", postgresql.UUID(), nullable=True),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("message_metadata", postgresql.JSONB(), server_default="{}", nullable=True),
        sa.Column("safety_checked", sa.BOOLEAN(), server_default="false", nullable=False),
        sa.Column("safety_flagged", sa.BOOLEAN(), server_default="false", nullable=False),
        sa.Column("turn_number", sa.INTEGER(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["pe.simulation_sessions.id"]),
        schema="pe",
    )

    # ── Persona Definitions ─────────────────────────────────────
    op.create_table(
        "persona_definitions",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=True),
        sa.Column("name", sa.VARCHAR(255), nullable=False),
        sa.Column("persona_type", sa.VARCHAR(50), nullable=False),
        sa.Column("age", sa.INTEGER(), nullable=True),
        sa.Column("gender", sa.VARCHAR(50), nullable=True),
        sa.Column("background", sa.Text(), nullable=True),
        sa.Column("personality_traits", postgresql.JSONB(), server_default="{}", nullable=True),
        sa.Column("clinical_conditions", postgresql.JSONB(), server_default="[]", nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("temperature", sa.DECIMAL(3, 2), server_default="0.70", nullable=False),
        sa.Column("max_tokens", sa.INTEGER(), server_default="512", nullable=False),
        sa.Column("is_global", sa.BOOLEAN(), server_default="false", nullable=False),
        sa.Column("is_active", sa.BOOLEAN(), server_default="true", nullable=False),
        sa.Column("version", sa.INTEGER(), server_default="1", nullable=False),
        sa.Column("created_by", postgresql.UUID(), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["pe.users.id"]),
        schema="pe",
    )

    # ── Persona Instances ───────────────────────────────────────
    op.create_table(
        "persona_instances",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("session_id", postgresql.UUID(), nullable=False),
        sa.Column("persona_definition_id", postgresql.UUID(), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("current_state", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("conversation_history", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("turn_count", sa.INTEGER(), server_default="0", nullable=False),
        sa.Column("tokens_consumed", sa.INTEGER(), server_default="0", nullable=False),
        sa.Column("is_active", sa.BOOLEAN(), server_default="true", nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["pe.simulation_sessions.id"]),
        sa.ForeignKeyConstraint(["persona_definition_id"], ["pe.persona_definitions.id"]),
        schema="pe",
    )

    # ── Metering Events ─────────────────────────────────────────
    op.create_table(
        "metering_events",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("event_type", sa.VARCHAR(50), nullable=False),
        sa.Column("idempotency_key", sa.VARCHAR(255), nullable=False),
        sa.Column("actor_id", postgresql.UUID(), nullable=True),
        sa.Column("session_id", postgresql.UUID(), nullable=True),
        sa.Column("quantity", sa.DECIMAL(12, 4), nullable=False),
        sa.Column("unit", sa.VARCHAR(20), nullable=False),
        sa.Column("payload", postgresql.JSONB(), server_default="{}", nullable=True),
        sa.Column("source", sa.VARCHAR(100), nullable=False),
        sa.Column("event_timestamp", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("ingested_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["pe.users.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["pe.simulation_sessions.id"]),
        schema="pe",
    )

    # ── Daily Rollups ───────────────────────────────────────────
    op.create_table(
        "metering_daily_rollups",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("rollup_date", sa.DATE(), nullable=False),
        sa.Column("active_seats", sa.INTEGER(), server_default="0", nullable=False),
        sa.Column("peak_seats", sa.INTEGER(), server_default="0", nullable=False),
        sa.Column("simulation_hours", sa.DECIMAL(12, 4), server_default="0", nullable=False),
        sa.Column("session_count", sa.INTEGER(), server_default="0", nullable=False),
        sa.Column("total_tokens_input", sa.BIGINT(), server_default="0", nullable=False),
        sa.Column("total_tokens_output", sa.BIGINT(), server_default="0", nullable=False),
        sa.Column("total_tokens", sa.BIGINT(), server_default="0", nullable=False),
        sa.Column("computed_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("institution_id", "rollup_date"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        schema="pe",
    )

    # ── Billing Periods ─────────────────────────────────────────
    op.create_table(
        "billing_periods",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=False),
        sa.Column("period_start", sa.DATE(), nullable=False),
        sa.Column("period_end", sa.DATE(), nullable=False),
        sa.Column("total_active_seats", sa.INTEGER(), server_default="0", nullable=False),
        sa.Column("total_simulation_hours", sa.DECIMAL(12, 4), server_default="0", nullable=False),
        sa.Column("total_tokens", sa.BIGINT(), server_default="0", nullable=False),
        sa.Column("amount_due", sa.DECIMAL(12, 2), server_default="0", nullable=False),
        sa.Column("currency", sa.VARCHAR(3), server_default="USD", nullable=False),
        sa.Column("invoice_status", sa.VARCHAR(50), server_default="pending", nullable=False),
        sa.Column("invoice_url", sa.VARCHAR(500), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("institution_id", "period_start"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        schema="pe",
    )

    # ── Audit Log ───────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(), nullable=False),
        sa.Column("actor_id", postgresql.UUID(), nullable=True),
        sa.Column("actor_role", sa.VARCHAR(50), nullable=True),
        sa.Column("action", sa.VARCHAR(100), nullable=False),
        sa.Column("resource_type", sa.VARCHAR(100), nullable=False),
        sa.Column("resource_id", postgresql.UUID(), nullable=True),
        sa.Column("payload", postgresql.JSONB(), server_default="{}", nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("prev_hash", sa.VARCHAR(64), nullable=True),
        sa.Column("row_hash", sa.VARCHAR(64), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["pe.institutions.id"]),
        schema="pe",
    )

    # ── PHI Guard Events ────────────────────────────────────────
    op.create_table(
        "phi_guard_events",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=True),
        sa.Column("detected_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("source", sa.VARCHAR(100), nullable=False),
        sa.Column("endpoint", sa.VARCHAR(500), nullable=True),
        sa.Column("phi_pattern", sa.VARCHAR(50), nullable=False),
        sa.Column("action_taken", sa.VARCHAR(50), nullable=False),
        sa.Column("actor_id", postgresql.UUID(), nullable=True),
        sa.Column("context_description", sa.Text(), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["pe.users.id"]),
        schema="pe",
    )

    # ── PHI Guard Allowlist ─────────────────────────────────────
    op.create_table(
        "phi_guard_allowlist",
        sa.Column("id", postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("institution_id", postgresql.UUID(), nullable=True),
        sa.Column("pattern", sa.VARCHAR(255), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_by", postgresql.UUID(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("institution_id", "pattern"),
        sa.ForeignKeyConstraint(["institution_id"], ["pe.institutions.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["pe.users.id"]),
        schema="pe",
    )

    # ── Functions ───────────────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION pe.current_tenant_id()
        RETURNS UUID AS $$
        BEGIN
            RETURN current_setting('app.tenant_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION pe.is_super_admin()
        RETURNS BOOLEAN AS $$
        BEGIN
            RETURN current_setting('app.user_role') = 'super_admin';
        EXCEPTION WHEN OTHERS THEN
            RETURN FALSE;
        END;
        $$ LANGUAGE plpgsql STABLE
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION pe.set_session_context(
            p_tenant_id UUID, p_user_id UUID, p_user_role VARCHAR
        ) RETURNS VOID AS $$
        BEGIN
            PERFORM set_config('app.tenant_id', p_tenant_id::text, TRUE);
            PERFORM set_config('app.user_id', p_user_id::text, TRUE);
            PERFORM set_config('app.user_role', p_user_role::text, TRUE);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER
    """)

    # ── Audit Hash Function ─────────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION pe.compute_audit_hash()
        RETURNS TRIGGER AS $$
        DECLARE
            last_hash VARCHAR(64);
            row_content TEXT;
        BEGIN
            SELECT row_hash INTO last_hash FROM pe.audit_log
            ORDER BY created_at DESC, id DESC LIMIT 1;
            NEW.prev_hash := last_hash;
            row_content := COALESCE(NEW.tenant_id::text, '') || '|' ||
                           COALESCE(NEW.actor_id::text, '') || '|' ||
                           COALESCE(NEW.action::text, '') || '|' ||
                           COALESCE(NEW.resource_type, '') || '|' ||
                           COALESCE(NEW.resource_id::text, '') || '|' ||
                           COALESCE(NEW.payload::text, '{}') || '|' ||
                           COALESCE(NEW.ip_address::text, '') || '|' ||
                           COALESCE(NEW.user_agent, '') || '|' ||
                           COALESCE(last_hash, '') || '|' ||
                           COALESCE(NOW()::text, '');
            NEW.row_hash := encode(digest(row_content, 'sha256'), 'hex');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    op.execute("""
        CREATE TRIGGER trg_audit_hash
            BEFORE INSERT ON pe.audit_log
            FOR EACH ROW EXECUTE FUNCTION pe.compute_audit_hash()
    """)

    # ── Immutability triggers ───────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION pe.prevent_audit_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Audit log is immutable: UPDATE and DELETE are prohibited';
        END;
        $$ LANGUAGE plpgsql
    """)

    op.execute("""
        CREATE TRIGGER trg_prevent_audit_update
            BEFORE UPDATE ON pe.audit_log
            FOR EACH ROW EXECUTE FUNCTION pe.prevent_audit_mutation()
    """)

    op.execute("""
        CREATE TRIGGER trg_prevent_audit_delete
            BEFORE DELETE ON pe.audit_log
            FOR EACH ROW EXECUTE FUNCTION pe.prevent_audit_mutation()
    """)

    # ── Audit Helper Function ───────────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION pe.log_audit_event(
            p_action VARCHAR, p_resource_type VARCHAR,
            p_resource_id UUID DEFAULT NULL, p_payload JSONB DEFAULT '{}',
            p_ip_address INET DEFAULT NULL, p_user_agent TEXT DEFAULT NULL
        ) RETURNS UUID AS $$
        DECLARE v_event_id UUID;
        BEGIN
            INSERT INTO pe.audit_log (tenant_id, actor_id, actor_role, action,
                resource_type, resource_id, payload, ip_address, user_agent)
            VALUES (pe.current_tenant_id(),
                    current_setting('app.user_id')::UUID,
                    current_setting('app.user_role')::VARCHAR,
                    p_action, p_resource_type, p_resource_id,
                    p_payload, p_ip_address, p_user_agent)
            RETURNING id INTO v_event_id;
            RETURN v_event_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER
    """)

    # ── Metering Ingestion Function ─────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION pe.ingest_metering_event(
            p_institution_id UUID, p_event_type VARCHAR,
            p_idempotency_key VARCHAR, p_actor_id UUID DEFAULT NULL,
            p_session_id UUID DEFAULT NULL, p_quantity DECIMAL DEFAULT 0,
            p_unit VARCHAR DEFAULT NULL, p_payload JSONB DEFAULT '{}',
            p_source VARCHAR DEFAULT 'api', p_event_timestamp TIMESTAMPTZ DEFAULT NOW()
        ) RETURNS UUID AS $$
        DECLARE v_event_id UUID;
        BEGIN
            INSERT INTO pe.metering_events (institution_id, event_type,
                idempotency_key, actor_id, session_id, quantity, unit,
                payload, source, event_timestamp)
            VALUES (p_institution_id, p_event_type, p_idempotency_key,
                p_actor_id, p_session_id, p_quantity, p_unit,
                p_payload, p_source, p_event_timestamp)
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING id INTO v_event_id;
            RETURN v_event_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER
    """)

    # ── RLS ─────────────────────────────────────────────────────
    op.execute("ALTER TABLE pe.institutions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.institution_settings ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.scenarios ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.simulation_sessions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.simulation_messages ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.persona_definitions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.persona_instances ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.metering_events ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.metering_daily_rollups ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.billing_periods ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.audit_log ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pe.phi_guard_events ENABLE ROW LEVEL SECURITY")

    # RLS policy for institutions
    op.execute("""
        CREATE POLICY tenant_isolation_institutions ON pe.institutions
            FOR ALL USING (
                pe.is_super_admin() OR id = pe.current_tenant_id()
            )
    """)

    # RLS policies for tenant-scoped tables
    op.execute("""
        CREATE POLICY tenant_isolation_institution_settings ON pe.institution_settings
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_users ON pe.users
            FOR ALL USING (
                pe.is_super_admin() OR institution_id = pe.current_tenant_id()
                OR id = current_setting('app.user_id')::UUID
            )
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_scenarios ON pe.scenarios
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_simulation_sessions ON pe.simulation_sessions
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_simulation_messages ON pe.simulation_messages
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_persona_definitions ON pe.persona_definitions
            FOR ALL USING (
                pe.is_super_admin() OR institution_id = pe.current_tenant_id() OR institution_id IS NULL
            )
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_persona_instances ON pe.persona_instances
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_metering_events ON pe.metering_events
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_metering_daily_rollups ON pe.metering_daily_rollups
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_billing_periods ON pe.billing_periods
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_audit_log ON pe.audit_log
            FOR ALL USING (pe.is_super_admin() OR tenant_id = pe.current_tenant_id())
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_phi_guard_events ON pe.phi_guard_events
            FOR ALL USING (pe.is_super_admin() OR institution_id = pe.current_tenant_id())
    """)

    # ── Indexes ─────────────────────────────────────────────────
    op.create_index("idx_users_institution", "users", ["institution_id"], schema="pe")
    op.create_index("idx_users_email_hash", "users", ["email_hash"], schema="pe")
    op.create_index("idx_sim_messages_session", "simulation_messages", ["session_id", "turn_number"], schema="pe")
    op.create_index("idx_sessions_institution", "simulation_sessions", ["institution_id"], schema="pe")
    op.create_index("idx_sessions_learner", "simulation_sessions", ["learner_id"], schema="pe")
    op.create_index("idx_sessions_status", "simulation_sessions", ["status"], schema="pe")
    op.create_index("idx_metering_institution", "metering_events", ["institution_id", "event_timestamp"], schema="pe")
    op.create_index("idx_audit_tenant", "audit_log", ["tenant_id", sa.text("created_at DESC")], schema="pe")

    # ── Seed Data: Global Personas ──────────────────────────────
    op.execute("""
        INSERT INTO pe.persona_definitions (id, institution_id, name, persona_type, system_prompt, is_global, version)
        VALUES
        ('00000000-0000-0000-0000-000000000001', NULL, 'Standard Patient (Adult)', 'patient',
         'You are a cooperative adult patient presenting with clear symptoms. Answer questions directly.', TRUE, 1),
        ('00000000-0000-0000-0000-000000000002', NULL, 'Elderly Patient (Confused)', 'patient',
         'You are an elderly patient with mild confusion. You struggle to remember details.', TRUE, 1),
        ('00000000-0000-0000-0000-000000000003', NULL, 'Concerned Family Member', 'family',
         'You are an anxious family member worried about the patient.', TRUE, 1),
        ('00000000-0000-0000-0000-000000000004', NULL, 'Neutral Clinical Narrator', 'narrator',
         'You are a neutral clinical narrator. Present scenario context and vitals only.', TRUE, 1)
    """)


def downgrade() -> None:
    """Remove all schema objects."""
    op.execute("DROP SCHEMA IF EXISTS pe CASCADE")
    op.execute('DROP EXTENSION IF EXISTS "pgcrypto"')
    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp"')
