-- Defense mechanism readings per session
-- Tracks psychological defense mechanisms (denial, projection, etc.)
-- observed during therapy sessions, scored 0-5 intensity per turn.

CREATE TABLE IF NOT EXISTS defense_readings (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  therapist_id TEXT,
  mechanism TEXT NOT NULL,
  intensity NUMERIC(3,1) NOT NULL CHECK (intensity >= 0 AND intensity <= 5),
  turn INTEGER NOT NULL CHECK (turn >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defense_readings_session_id
  ON defense_readings (session_id);

CREATE INDEX IF NOT EXISTS idx_defense_readings_therapist_id
  ON defense_readings (therapist_id);

CREATE INDEX IF NOT EXISTS idx_defense_readings_mechanism
  ON defense_readings (mechanism);