-- ============================================================
-- AutoReview AI — Supabase Schema Migration
-- Run in Supabase SQL Editor or via psql.
-- ============================================================

-- ── Users ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id       BIGINT UNIQUE NOT NULL,
    github_login    TEXT NOT NULL,
    email           TEXT,
    avatar_url      TEXT,
    stripe_customer_id TEXT UNIQUE,
    tier            TEXT NOT NULL DEFAULT 'free',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_github_id ON users (github_id);
CREATE INDEX idx_users_stripe_customer_id
    ON users (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- ── Subscriptions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id)
                        ON DELETE CASCADE,
    stripe_sub_id       TEXT UNIQUE NOT NULL,
    tier                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active',
    current_period_end  TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id
    ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_stripe_sub_id
    ON subscriptions (stripe_sub_id);

-- ── Installations ───────────────────────────────────
CREATE TABLE IF NOT EXISTS installations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id)
                            ON DELETE CASCADE,
    github_installation_id  BIGINT UNIQUE NOT NULL,
    repos                   JSONB NOT NULL DEFAULT '[]'::jsonb,
    active                  BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_installations_user_id
    ON installations (user_id);
CREATE INDEX idx_installations_github_id
    ON installations (github_installation_id);

-- ── Usage ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id)
                ON DELETE CASCADE,
    pr_number   INTEGER NOT NULL,
    repo        TEXT NOT NULL,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'pending',
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_user_id ON usage (user_id);
CREATE INDEX idx_usage_created_at ON usage (created_at);
CREATE INDEX idx_usage_user_month ON usage (
    user_id,
    date_trunc('month', created_at)
);

-- ── Updated-at triggers ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_installations_updated_at
    BEFORE UPDATE ON installations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row-Level Security ──────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so the API (using
-- service key) has full access. These policies are
-- for any future direct Supabase client usage.
CREATE POLICY "Users can read own data"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can read own subscriptions"
    ON subscriptions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can read own installations"
    ON installations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can read own usage"
    ON usage FOR SELECT
    USING (user_id = auth.uid());

-- ── Usage counting view ─────────────────────────────
CREATE OR REPLACE VIEW monthly_usage AS
SELECT
    user_id,
    date_trunc('month', created_at) AS month,
    COUNT(*) AS pr_count,
    SUM(tokens_used) AS total_tokens
FROM usage
WHERE status IN ('success', 'partial')
GROUP BY user_id, date_trunc('month', created_at);
