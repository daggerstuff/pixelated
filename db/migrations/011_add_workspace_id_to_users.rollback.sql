-- PIX-215 rollback: drop the workspace_id index and column from users.
-- Does NOT drop workspaces (that's 010's rollback).

DROP INDEX IF EXISTS idx_users_workspace_id;
ALTER TABLE users DROP COLUMN IF EXISTS workspace_id;
