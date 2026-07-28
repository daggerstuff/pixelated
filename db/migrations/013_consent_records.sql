-- Migration: 013_consent_records.sql
-- Create consent_records and consent_audit_trail tables for HIPAA-compliant
-- consent persistence (7-year retention per HIPAA §164.530(j))
--

-- consent_records: durable storage for client consent state
CREATE TABLE IF NOT EXISTS consent_records (
  client_id           VARCHAR(255) PRIMARY KEY,
  current_level       VARCHAR(20) NOT NULL DEFAULT 'minimal'
                      CHECK (current_level IN ('none', 'minimal', 'limited', 'full')),
  consent_history     JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiration_date     TIMESTAMPTZ NOT NULL,
  withdrawal_requested BOOLEAN NOT NULL DEFAULT FALSE,
  withdrawal_date      TIMESTAMPTZ,
  data_purged         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- consent_audit_trail: append-only audit log with 7-year retention
CREATE TABLE IF NOT EXISTS consent_audit_trail (
  id          BIGSERIAL PRIMARY KEY,
  client_id   VARCHAR(255) NOT NULL,
  operation   VARCHAR(50) NOT NULL,
  old_level   VARCHAR(20),
  new_level   VARCHAR(20),
  reason      TEXT,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- HIPAA retention: 7 years (2555 days)
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2555 days')
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_consent_records_level
  ON consent_records (current_level);

CREATE INDEX IF NOT EXISTS idx_consent_records_expiration
  ON consent_records (expiration_date)
  WHERE withdrawal_requested = FALSE AND data_purged = FALSE;

CREATE INDEX IF NOT EXISTS idx_consent_records_withdrawal
  ON consent_records (withdrawal_requested)
  WHERE withdrawal_requested = TRUE;

CREATE INDEX IF NOT EXISTS idx_consent_audit_trail_client
  ON consent_audit_trail (client_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_consent_audit_trail_timestamp
  ON consent_audit_trail (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_consent_audit_trail_retention
  ON consent_audit_trail (expires_at);
