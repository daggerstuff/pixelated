-- Session table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  therapist_id UUID NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  state VARCHAR(16) NOT NULL,
  context JSONB,
  history JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Evaluation feedback table
CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  feedback TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
