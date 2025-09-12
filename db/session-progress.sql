-- Extend sessions table to include progress tracking data
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS progress_metrics JSONB,
ADD COLUMN IF NOT EXISTS progress_snapshots JSONB,
ADD COLUMN IF NOT EXISTS skill_scores JSONB;

-- Create index for better query performance on progress data
CREATE INDEX IF NOT EXISTS idx_sessions_therapist_progress
ON sessions (therapist_id, started_at)
WHERE progress_metrics IS NOT NULL;

-- Create table for detailed session analytics
CREATE TABLE IF NOT EXISTS session_analytics (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC,
  metric_category VARCHAR(50),
  recorded_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Create index for session analytics queries
CREATE INDEX IF NOT EXISTS idx_session_analytics_session
ON session_analytics (session_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_session_analytics_metric
ON session_analytics (metric_name, recorded_at);

-- Create table for skill development tracking
CREATE TABLE IF NOT EXISTS skill_development (
  id SERIAL PRIMARY KEY,
  therapist_id UUID NOT NULL,
  skill_name TEXT NOT NULL,
  skill_category VARCHAR(50),
  current_score NUMERIC,
  target_score NUMERIC,
  practice_sessions INTEGER DEFAULT 0,
 last_practiced TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ensure existing installations where skill_name may have been created with a smaller length
DO $$
BEGIN
  -- If the column exists and its character maximum length is less than 100, alter it to varchar(100)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skill_development'
      AND column_name = 'skill_name'
      -- If the column is not already TEXT, alter it to TEXT
      AND data_type != 'text'
  ) THEN
    ALTER TABLE skill_development
    ALTER COLUMN skill_name TYPE TEXT;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- table doesn't exist yet; nothing to do
  NULL;
END$$;

-- Deduplicate skill_development on (therapist_id, skill_name) before adding unique constraint
WITH duplicates AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY therapist_id, skill_name
      ORDER BY updated_at DESC, created_at DESC, ctid
    ) AS rn
  FROM skill_development
)
DELETE FROM skill_development
WHERE ctid IN (
  SELECT ctid FROM duplicates WHERE rn > 1
);

-- Create unique index for skill development upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_development_therapist
ON skill_development (therapist_id, skill_name);

-- Create table for session milestones
CREATE TABLE IF NOT EXISTS session_milestones (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  milestone_name VARCHAR(100) NOT NULL,
  milestone_value NUMERIC,
  achieved_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Create index for session milestones
CREATE INDEX IF NOT EXISTS idx_session_milestones_session
ON session_milestones (session_id, achieved_at);

-- Create table for comparative session analysis
CREATE TABLE IF NOT EXISTS session_comparisons (
  id SERIAL PRIMARY KEY,
  therapist_id UUID NOT NULL,
  current_session_id UUID REFERENCES sessions(id),
  previous_session_id UUID REFERENCES sessions(id),
  improvement_score NUMERIC,
  comparison_metrics JSONB,
  analyzed_at TIMESTAMP DEFAULT NOW()
);

-- Create index for session comparisons
CREATE INDEX IF NOT EXISTS idx_session_comparisons_therapist
ON session_comparisons (therapist_id, analyzed_at);

-- Add comments for documentation
COMMENT ON TABLE session_analytics IS 'Detailed analytics data for therapist training sessions';
COMMENT ON TABLE skill_development IS 'Skill development tracking for therapists';
COMMENT ON TABLE session_milestones IS 'Milestone tracking for individual sessions';
COMMENT ON TABLE session_comparisons IS 'Comparative analysis between sessions';

-- Add unique constraint for upserts (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'skill_development'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'ux_skill_development_therapist_skill'
  ) THEN
    ALTER TABLE skill_development
      ADD CONSTRAINT ux_skill_development_therapist_skill UNIQUE (therapist_id, skill_name);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, do nothing
  NULL;
END$$;