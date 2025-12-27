-- Create users table for Pixelated Empathy application
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'therapist',
    institution VARCHAR(255),
    license_number VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_profiles table for additional user information
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    specializations TEXT[],
    years_experience INTEGER,
    certifications TEXT[],
    languages TEXT[] DEFAULT '{"en"}',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create sessions table for therapy sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES users(id),
    client_id UUID,
    session_type VARCHAR(50) DEFAULT 'individual',
    context JSONB,
    state VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bias_analyses table for bias detection results
CREATE TABLE IF NOT EXISTS bias_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id),
    therapist_id UUID NOT NULL REFERENCES users(id),
    overall_bias_score DECIMAL(5,4),
    alert_level VARCHAR(20),
    confidence DECIMAL(5,4),
    layer_results JSONB,
    recommendations TEXT[],
    demographics JSONB,
    content_hash VARCHAR(64),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_therapist ON sessions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_therapist ON bias_analyses(therapist_id);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_session ON bias_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_content_hash ON bias_analyses(content_hash);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE
    ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE
    ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE
    ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a sample admin user
INSERT INTO users (email, password_hash, first_name, last_name, role, institution, is_active)
VALUES ('admin@example.com', '$2b$10$example_hash_here', 'Admin', 'User', 'admin', 'Pixelated Empathy', true)
ON CONFLICT (email) DO NOTHING;

-- Insert a sample therapist user
INSERT INTO users (email, password_hash, first_name, last_name, role, institution, license_number, is_active)
VALUES ('therapist@example.com', '$2b$10$example_hash_here', 'Sample', 'Therapist', 'therapist', 'Demo Institution', 'LIC123456', true)
ON CONFLICT (email) DO NOTHING;