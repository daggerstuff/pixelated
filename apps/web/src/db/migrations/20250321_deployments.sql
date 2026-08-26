-- Deployments tracking table for rollback functionality
-- This table stores deployment history and status information

-- Drop table if exists (for idempotency)
DROP TABLE IF EXISTS deployments;

-- Create deployments table
CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'in_progress', 'rolled_back')),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
  version TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  deployed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  is_latest BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Ensure we have meaningful constraints
  CONSTRAINT deployments_status_check CHECK (
    (status = 'rolled_back' AND rolled_back_at IS NOT NULL) OR
    (status != 'rolled_back' AND rolled_back_at IS NULL)
  )
);

-- Add indexes for common queries
CREATE INDEX deployments_environment_idx ON deployments (environment);
CREATE INDEX deployments_status_idx ON deployments (status);
CREATE INDEX deployments_latest_idx ON deployments (environment, is_latest) WHERE is_latest = TRUE;

-- Create RLS policies
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Admin can do anything
CREATE POLICY admin_all_deployments ON deployments
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Users can read deployments
CREATE POLICY read_deployments ON deployments
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Add comments for documentation
COMMENT ON TABLE deployments IS 'Records of application deployments for tracking and rollback functionality';
COMMENT ON COLUMN deployments.id IS 'Unique deployment identifier (usually timestamp-commitsha format)';
COMMENT ON COLUMN deployments.status IS 'Deployment status (success, failure, in_progress, rolled_back)';
COMMENT ON COLUMN deployments.environment IS 'Deployment environment (development, staging, production)';
COMMENT ON COLUMN deployments.version IS 'Application version from package.json';
COMMENT ON COLUMN deployments.commit_hash IS 'Git commit hash of the deployed code';
COMMENT ON COLUMN deployments.deployed_at IS 'Timestamp when deployment was created';
COMMENT ON COLUMN deployments.rolled_back_at IS 'Timestamp when deployment was rolled back (if applicable)';
COMMENT ON COLUMN deployments.is_latest IS 'Flag indicating if this is the latest deployment for the environment';
COMMENT ON COLUMN deployments.metadata IS 'Additional deployment metadata (CI build number, user, etc.)';

-- Create deployments_history view for easier querying
CREATE OR REPLACE VIEW deployments_history AS
SELECT
  id,
  status,
  environment,
  version,
  commit_hash,
  deployed_at,
  rolled_back_at,
  is_latest,
  metadata,
  CASE
    WHEN status = 'success' AND is_latest THEN 'current'
    WHEN status = 'success' THEN 'previous'
    WHEN status = 'rolled_back' THEN 'rolled back'
    WHEN status = 'failure' THEN 'failed'
    WHEN status = 'in_progress' THEN 'deploying'
    ELSE status
  END as status_display
FROM deployments
ORDER BY deployed_at DESC;

-- Add sample data for development environment
DO $$
BEGIN
  IF current_setting('app.environment', TRUE) = 'development' THEN
    INSERT INTO deployments (id, status, environment, version, commit_hash, deployed_at, is_latest, metadata)
    VALUES
      ('20250320120000-abcd1234', 'success', 'staging', '1.0.0', 'abcd1234', now() - interval '3 days', false, '{"ci_build_number": "123", "deployment_user": "devuser"}'::jsonb),
      ('20250321120000-efgh5678', 'success', 'staging', '1.0.1', 'efgh5678', now() - interval '2 days', false, '{"ci_build_number": "124", "deployment_user": "devuser"}'::jsonb),
      ('20250322120000-ijkl9012', 'success', 'staging', '1.0.2', 'ijkl9012', now() - interval '1 day', true, '{"ci_build_number": "125", "deployment_user": "devuser"}'::jsonb);
  END IF;
END
$$;
