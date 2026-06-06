-- PIX-215: Create workspaces table for multi-org/multi-workspace scoping
-- Migration 010 of the 001-009 series. Continues db/migrations/.

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'archived')),
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);

-- Seed a default "personal" workspace for the 011 backfill.
-- Fixed UUID is intentional: deterministic sentinel used by every legacy
-- single-tenant user until they create a real workspace. Never deleted.
INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Personal',
    'personal',
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;
