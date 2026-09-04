-- PIX-215: Create RBAC tables to replace the single users.role string.
-- Depends on 011 (workspace_id must exist on users) and 010 (workspaces table).
-- Run order: 010 → 011 → 012.
--
-- Model: per-workspace roles. workspace_id NULL = system role (cross-workspace).
-- is_system=true marks roles that cannot be deleted (e.g. the 'admin' system role).

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    description TEXT,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT roles_workspace_or_system CHECK (
        (workspace_id IS NOT NULL AND is_system = false)
        OR (workspace_id IS NULL AND is_system = true)
    ),
    UNIQUE(workspace_id, name)
);

-- Enforce uniqueness of system roles by name (workspace_id IS NULL).
-- Postgres treats NULLs as distinct in composite unique constraints, so
-- UNIQUE(workspace_id, name) alone would allow duplicate system role names.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_roles_system_name
  ON roles (name)
  WHERE workspace_id IS NULL;

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, workspace_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_workspace_id ON roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_workspace_id ON user_roles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- Seed default roles in the personal workspace + one system role.
-- Fixed UUIDs are intentional: deterministic sentinels referenced by
-- 011's backfill and future code paths.
INSERT INTO roles (id, name, workspace_id, description, permissions, is_system)
VALUES
    (
        '00000000-0000-0000-0000-000000000010',
        'therapist',
        '00000000-0000-0000-0000-000000000001',
        'Licensed therapist',
        ARRAY['session.read', 'session.write', 'client.read']::TEXT[],
        false
    ),
    (
        '00000000-0000-0000-0000-000000000011',
        'client',
        '00000000-0000-0000-0000-000000000001',
        'Therapy client',
        ARRAY['session.read.own']::TEXT[],
        false
    ),
    (
        '00000000-0000-0000-0000-000000000012',
        'admin',
        NULL,
        'System administrator',
        ARRAY['*']::TEXT[],
        true
    )
ON CONFLICT DO NOTHING;

-- Backfill: map existing users.role string to user_roles (workspace-scoped only).
-- Users with role='admin' do NOT auto-receive the system admin role here; admin
-- assignment is a separate explicit flow. Custom role strings not in {therapist,
-- client} will need manual migration in a follow-up.
INSERT INTO user_roles (user_id, workspace_id, role_id, granted_by, granted_at)
SELECT u.id, u.workspace_id, r.id, NULL, NOW()
FROM users u
JOIN roles r
  ON r.name = u.role
 AND r.workspace_id = u.workspace_id
WHERE u.workspace_id IS NOT NULL
ON CONFLICT DO NOTHING;
