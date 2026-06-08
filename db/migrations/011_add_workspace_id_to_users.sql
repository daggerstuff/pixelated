-- PIX-215: Add workspace_id FK to users and backfill from the personal workspace.
-- Depends on 010_create_workspaces_table.sql (the 'personal' workspace row).
-- Run order: 010 → 011 → 012.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS workspace_id UUID
    REFERENCES workspaces(id) ON DELETE RESTRICT;

-- Backfill every existing user to the default personal workspace.
-- Safe to re-run: WHERE clause filters to NULL rows.
UPDATE users
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

-- Enforce NOT NULL only after the backfill has populated every row.
-- Idempotent guard: skip if already NOT NULL.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'workspace_id'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE users ALTER COLUMN workspace_id SET NOT NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(workspace_id);
