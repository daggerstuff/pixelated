-- Pattern Analysis Schema
-- Requires pgcrypto extension for encryption functions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trend Patterns Table
CREATE TABLE trend_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('emotion', 'risk', 'intervention')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    significance DECIMAL(5,4) NOT NULL CHECK (significance BETWEEN 0 AND 1),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    description TEXT NOT NULL,
    related_factors JSONB NOT NULL,
    recommendations JSONB NOT NULL,
    encrypted_data BYTEA, -- For FHE-encrypted data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Cross-session Patterns Table
CREATE TABLE cross_session_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('trigger', 'response', 'outcome')),
    pattern_description TEXT NOT NULL,
    frequency INTEGER NOT NULL CHECK (frequency >= 0),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    impact VARCHAR(20) NOT NULL CHECK (impact IN ('positive', 'negative', 'neutral')),
    recommendations JSONB NOT NULL,
    session_ids UUID[] NOT NULL,
    encrypted_data BYTEA, -- For FHE-encrypted data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Risk Correlations Table
CREATE TABLE risk_correlations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id),
    primary_factor VARCHAR(100) NOT NULL,
    correlated_factors JSONB NOT NULL,
    time_frame_start TIMESTAMP WITH TIME ZONE NOT NULL,
    time_frame_end TIMESTAMP WITH TIME ZONE NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    action_required BOOLEAN NOT NULL DEFAULT false,
    encrypted_data BYTEA, -- For FHE-encrypted data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_time_frame CHECK (time_frame_end > time_frame_start)
);

-- Indexes for better query performance
CREATE INDEX idx_trend_patterns_client_id ON trend_patterns(client_id);
CREATE INDEX idx_trend_patterns_type ON trend_patterns(type);
CREATE INDEX idx_trend_patterns_time_range ON trend_patterns(start_time, end_time);

CREATE INDEX idx_cross_session_patterns_client_id ON cross_session_patterns(client_id);
CREATE INDEX idx_cross_session_patterns_type ON cross_session_patterns(type);
CREATE INDEX idx_cross_session_patterns_impact ON cross_session_patterns(impact);

CREATE INDEX idx_risk_correlations_client_id ON risk_correlations(client_id);
CREATE INDEX idx_risk_correlations_severity ON risk_correlations(severity);
CREATE INDEX idx_risk_correlations_time_frame ON risk_correlations(time_frame_start, time_frame_end);

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trend_patterns_updated_at
    BEFORE UPDATE ON trend_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cross_session_patterns_updated_at
    BEFORE UPDATE ON cross_session_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_correlations_updated_at
    BEFORE UPDATE ON risk_correlations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Security policies for row-level security
ALTER TABLE trend_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_session_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_correlations ENABLE ROW LEVEL SECURITY;

-- Policies for therapists to access their clients' data
CREATE POLICY trend_patterns_therapist_access ON trend_patterns
    FOR ALL
    TO therapist
    USING (client_id IN (SELECT client_id FROM therapist_client_relationships WHERE therapist_id = current_user_id()));

CREATE POLICY cross_session_patterns_therapist_access ON cross_session_patterns
    FOR ALL
    TO therapist
    USING (client_id IN (SELECT client_id FROM therapist_client_relationships WHERE therapist_id = current_user_id()));

CREATE POLICY risk_correlations_therapist_access ON risk_correlations
    FOR ALL
    TO therapist
    USING (client_id IN (SELECT client_id FROM therapist_client_relationships WHERE therapist_id = current_user_id()));
