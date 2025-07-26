-- SQL script to create the crisis_events table for Neon Postgres
CREATE TABLE IF NOT EXISTS crisis_events (
  id SERIAL PRIMARY KEY,
  case_id VARCHAR(64) NOT NULL,
  patient_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  alert_level VARCHAR(16) NOT NULL,
  detection_score REAL NOT NULL,
  detected_risks JSONB NOT NULL,
  text_sample TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL
);

-- Index for fast lookup by case_id
CREATE INDEX IF NOT EXISTS idx_crisis_events_case_id ON crisis_events(case_id);