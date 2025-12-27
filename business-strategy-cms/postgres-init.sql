-- PostgreSQL initialization script
-- This script runs when the PostgreSQL container is first created

-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS business_strategy_cms;

-- Connect to the business_strategy_cms database
\c business_strategy_cms;

-- Create business alerts table
CREATE TABLE IF NOT EXISTS business_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    conditions JSONB,
    recipients JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create KPI dashboards table
CREATE TABLE IF NOT EXISTS kpi_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metrics JSONB,
    widgets JSONB,
    layout JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_shared BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user sessions table for PostgreSQL
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    refresh_token VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow states table
CREATE TABLE IF NOT EXISTS workflow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create workflow transitions table
CREATE TABLE IF NOT EXISTS workflow_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_state_id UUID REFERENCES workflow_states(id),
    to_state_id UUID REFERENCES workflow_states(id),
    action VARCHAR(100) NOT NULL,
    conditions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create document metadata table for PostgreSQL
CREATE TABLE IF NOT EXISTS document_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    tags TEXT[],
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    file_size BIGINT,
    file_type VARCHAR(50),
    file_path TEXT,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_business_alerts_type ON business_alerts(type);
CREATE INDEX IF NOT EXISTS idx_business_alerts_severity ON business_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_business_alerts_created_at ON business_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_business_alerts_is_active ON business_alerts(is_active);

CREATE INDEX IF NOT EXISTS idx_kpi_dashboards_name ON kpi_dashboards(name);
CREATE INDEX IF NOT EXISTS idx_kpi_dashboards_is_shared ON kpi_dashboards(is_shared);
CREATE INDEX IF NOT EXISTS idx_kpi_dashboards_created_at ON kpi_dashboards(created_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);

CREATE INDEX IF NOT EXISTS idx_document_metadata_category ON document_metadata(category);
CREATE INDEX IF NOT EXISTS idx_document_metadata_status ON document_metadata(status);
CREATE INDEX IF NOT EXISTS idx_document_metadata_created_by ON document_metadata(created_by);
CREATE INDEX IF NOT EXISTS idx_document_metadata_created_at ON document_metadata(created_at);
CREATE INDEX IF NOT EXISTS idx_document_metadata_tags ON document_metadata USING GIN(tags);

-- Insert sample workflow states
INSERT INTO workflow_states (name, description, color) VALUES
    ('Draft', 'Initial draft state', '#6c757d'),
    ('In Review', 'Under review by team', '#ffc107'),
    ('Approved', 'Approved by reviewer', '#28a745'),
    ('Published', 'Published and live', '#007bff'),
    ('Archived', 'Archived for reference', '#dc3545')
ON CONFLICT DO NOTHING;

-- Insert sample workflow transitions
INSERT INTO workflow_transitions (from_state_id, to_state_id, action) 
SELECT 
    (SELECT id FROM workflow_states WHERE name = 'Draft'),
    (SELECT id FROM workflow_states WHERE name = 'In Review'),
    'Submit for Review'
WHERE NOT EXISTS (SELECT 1 FROM workflow_transitions WHERE action = 'Submit for Review');

INSERT INTO workflow_transitions (from_state_id, to_state_id, action) 
SELECT 
    (SELECT id FROM workflow_states WHERE name = 'In Review'),
    (SELECT id FROM workflow_states WHERE name = 'Approved'),
    'Approve'
WHERE NOT EXISTS (SELECT 1 FROM workflow_transitions WHERE action = 'Approve');

INSERT INTO workflow_transitions (from_state_id, to_state_id, action) 
SELECT 
    (SELECT id FROM workflow_states WHERE name = 'In Review'),
    (SELECT id FROM workflow_states WHERE name = 'Draft'),
    'Request Changes'
WHERE NOT EXISTS (SELECT 1 FROM workflow_transitions WHERE action = 'Request Changes');

INSERT INTO workflow_transitions (from_state_id, to_state_id, action) 
SELECT 
    (SELECT id FROM workflow_states WHERE name = 'Approved'),
    (SELECT id FROM workflow_states WHERE name = 'Published'),
    'Publish'
WHERE NOT EXISTS (SELECT 1 FROM workflow_transitions WHERE action = 'Publish');

-- Insert sample business alerts
INSERT INTO business_alerts (type, title, description, severity, conditions, recipients) VALUES
    ('revenue_threshold', 'Revenue Alert', 'Revenue has dropped below $100,000 for the current month', 'high', '{"threshold": 100000, "comparison": "less_than"}', '["admin@company.com", "finance@company.com"]'),
    ('churn_rate', 'High Churn Rate', 'Customer churn rate has exceeded 5%', 'critical', '{"threshold": 0.05, "comparison": "greater_than"}', '["customer-success@company.com"]'),
    ('market_share', 'Market Share Alert', 'Market share has decreased by more than 2%', 'medium', '{"threshold": 0.02, "comparison": "decrease_by"}', '["strategy@company.com"]')
ON CONFLICT DO NOTHING;

-- Insert sample KPI dashboard
INSERT INTO kpi_dashboards (name, description, metrics, widgets, is_shared, is_default) VALUES
    ('Executive Dashboard', 'High-level business metrics for executives', 
    '{"revenue": {"value": 1000000, "target": 1200000, "unit": "USD"}, "growth_rate": {"value": 0.25, "target": 0.30, "unit": "percentage"}, "customer_acquisition_cost": {"value": 250, "target": 200, "unit": "USD"}}',
    '[{"type": "metric_card", "title": "Monthly Revenue", "data_key": "revenue", "position": {"x": 0, "y": 0, "w": 3, "h": 2}}, {"type": "gauge", "title": "Growth Rate", "data_key": "growth_rate", "position": {"x": 3, "y": 0, "w": 3, "h": 2}}, {"type": "chart", "title": "Revenue Trend", "data_key": "revenue", "position": {"x": 0, "y": 2, "w": 6, "h": 4}}]',
    true, true)
ON CONFLICT DO NOTHING;

-- Insert sample document metadata
INSERT INTO document_metadata (document_id, title, description, tags, category, created_by, file_size, file_type) VALUES
    ('doc_001', 'Q4 Business Strategy', 'Strategic planning document for Q4 2024', '{"strategy", "planning", "q4"}', 'strategy', 'admin@company.com', 1024000, 'application/pdf'),
    ('doc_002', 'Market Analysis Report', 'Comprehensive analysis of technology market', '{"market", "analysis", "technology"}', 'research', 'analyst@company.com', 2048000, 'application/pdf'),
    ('doc_003', 'Customer Feedback Summary', 'Summary of customer feedback from Q3', '{"feedback", "customer", "q3"}', 'feedback', 'customer-success@company.com', 512000, 'application/pdf')
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_business_alerts_updated_at BEFORE UPDATE ON business_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpi_dashboards_updated_at BEFORE UPDATE ON kpi_dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_metadata_updated_at BEFORE UPDATE ON document_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;

-- PostgreSQL initialization completed
SELECT 'PostgreSQL initialization completed successfully!' as status;