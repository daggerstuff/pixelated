-- Migration: Add developer_api_keys table for external API authentication
-- This table stores hashed API keys for developers to authenticate API requests

CREATE TABLE IF NOT EXISTS developer_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(8) NOT NULL,
    name VARCHAR(255) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{"read", "write"}',
    rate_limit INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_user_id ON developer_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_key_prefix ON developer_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_is_active ON developer_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_expires_at ON developer_api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Rate limit tracking table for API keys
CREATE TABLE IF NOT EXISTS api_key_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES developer_api_keys(id) ON DELETE CASCADE,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    request_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE(api_key_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_key_rate_limits_key_window ON api_key_rate_limits(api_key_id, window_start DESC);
