-- ===========================================
-- PIXELATED DATABASE SCHEMA
-- ===========================================

-- Users table (for therapists and administrators)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'therapist', -- therapist, admin, researcher
  institution VARCHAR(255),
  license_number VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles (extended information)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  specializations TEXT[],
  years_experience INTEGER,
  certifications TEXT[],
  languages TEXT[] DEFAULT ARRAY['en'],
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Session table (therapy sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID, -- Anonymous client identifier
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_minutes INTEGER,
  state VARCHAR(16) NOT NULL DEFAULT 'active', -- active, completed, paused
  session_type VARCHAR(50) DEFAULT 'individual', -- individual, group, family
  context JSONB, -- Session context and metadata
  transcript TEXT, -- Full session transcript
  summary TEXT, -- AI-generated session summary
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bias analysis results
CREATE TABLE IF NOT EXISTS bias_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  overall_bias_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  alert_level VARCHAR(20) NOT NULL, -- low, medium, high, critical
  confidence DECIMAL(3,2), -- 0.00 to 1.00
  layer_results JSONB, -- Detailed results by analysis layer
  recommendations TEXT[], -- Array of actionable recommendations
  demographics JSONB, -- Client demographics used in analysis
  content_hash VARCHAR(64), -- Hash of analyzed content for caching
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bias analysis history (for trending and longitudinal analysis)
CREATE TABLE IF NOT EXISTS bias_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_analyses INTEGER DEFAULT 0,
  average_bias_score DECIMAL(3,2),
  alert_counts JSONB DEFAULT '{}', -- {low: 0, medium: 0, high: 0, critical: 0}
  trend_direction VARCHAR(20), -- improving, stable, worsening
  percentile_rank INTEGER, -- Therapist's performance percentile
  created_at TIMESTAMP DEFAULT NOW()
);

-- Evaluation feedback table
CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  therapist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_type VARCHAR(50) DEFAULT 'general', -- general, technical, clinical
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Institutions/Organizations
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'university', -- university, hospital, clinic, private
  address JSONB,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  website VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Institution memberships
CREATE TABLE IF NOT EXISTS institution_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- member, admin, faculty
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log (HIPAA compliant)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- System configuration
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB,
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_therapist_id ON sessions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(state);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- Bias analyses indexes
CREATE INDEX IF NOT EXISTS idx_bias_analyses_session_id ON bias_analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_therapist_id ON bias_analyses(therapist_id);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_alert_level ON bias_analyses(alert_level);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_created_at ON bias_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_bias_analyses_content_hash ON bias_analyses(content_hash);

-- API usage indexes
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ===========================================
-- VIEWS FOR COMMON QUERIES
-- ===========================================

-- Recent bias analysis summary
CREATE OR REPLACE VIEW recent_bias_summary AS
SELECT
  ba.therapist_id,
  u.first_name,
  u.last_name,
  COUNT(*) as total_analyses,
  ROUND(AVG(ba.overall_bias_score)::numeric, 3) as avg_bias_score,
  COUNT(CASE WHEN ba.alert_level IN ('high', 'critical') THEN 1 END) as high_alerts,
  MAX(ba.created_at) as last_analysis
FROM bias_analyses ba
JOIN users u ON ba.therapist_id = u.id
WHERE ba.created_at >= NOW() - INTERVAL '30 days'
GROUP BY ba.therapist_id, u.first_name, u.last_name
ORDER BY avg_bias_score DESC;

-- Session activity summary
CREATE OR REPLACE VIEW session_activity_summary AS
SELECT
  s.therapist_id,
  u.first_name,
  u.last_name,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN s.state = 'completed' THEN 1 END) as completed_sessions,
  ROUND(AVG(EXTRACT(EPOCH FROM (s.ended_at - s.started_at))/60)::numeric, 1) as avg_session_minutes,
  MAX(s.started_at) as last_session_date
FROM sessions s
JOIN users u ON s.therapist_id = u.id
WHERE s.created_at >= NOW() - INTERVAL '30 days'
GROUP BY s.therapist_id, u.first_name, u.last_name
ORDER BY total_sessions DESC;

-- ===========================================
-- INITIAL DATA SEEDING
-- ===========================================

-- Insert default system configuration
INSERT INTO system_config (key, value, description) VALUES
('bias_thresholds', '{"low": 0.3, "medium": 0.5, "high": 0.7, "critical": 0.8}', 'Bias score thresholds for alert levels'),
('api_rate_limits', '{"per_minute": 60, "per_hour": 1000, "per_day": 5000}', 'API rate limiting configuration'),
('retention_periods', '{"sessions": 2555, "analyses": 2555, "audit_logs": 2555}', 'Data retention periods in days'),
('feature_flags', '{"real_time_analysis": true, "batch_processing": true, "advanced_analytics": false}', 'Feature availability flags')
ON CONFLICT (key) DO NOTHING;

-- ===========================================
-- FUNCTIONS AND TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_institutions_updated_at BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))/60;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_session_duration_trigger
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_session_duration();

-- Function for audit logging
CREATE OR REPLACE FUNCTION audit_session_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (user_id, session_id, action, resource_type, resource_id, details)
        VALUES (NEW.therapist_id, NEW.id, 'session_created', 'session', NEW.id, row_to_json(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (user_id, session_id, action, resource_type, resource_id, details)
        VALUES (NEW.therapist_id, NEW.id, 'session_updated', 'session', NEW.id,
                json_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (user_id, session_id, action, resource_type, resource_id, details)
        VALUES (OLD.therapist_id, OLD.id, 'session_deleted', 'session', OLD.id, row_to_json(OLD));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER audit_sessions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION audit_session_changes();
