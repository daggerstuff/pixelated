-- PIX-215 rollback: drop the workspaces table and its indexes.
-- Drops the seed row implicitly via CASCADE on the table itself.

DROP INDEX IF EXISTS idx_workspaces_status;
DROP INDEX IF EXISTS idx_workspaces_slug;
DROP TABLE IF EXISTS workspaces;
