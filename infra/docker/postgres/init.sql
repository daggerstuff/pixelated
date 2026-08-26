-- PostgreSQL initialization script for Pixelated Empathy microservices

-- Create databases for each service
CREATE DATABASE pixelated_bias;
CREATE DATABASE pixelated_ai;
CREATE DATABASE pixelated_analytics;

-- Create users for each service
CREATE USER bias_detection_user WITH PASSWORD 'bias_detection_pass';
CREATE USER ai_service_user WITH PASSWORD 'ai_service_pass';
CREATE USER analytics_user WITH PASSWORD 'analytics_pass';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pixelated_bias TO bias_detection_user;
GRANT ALL PRIVILEGES ON DATABASE pixelated_ai TO ai_service_user;
GRANT ALL PRIVILEGES ON DATABASE pixelated_analytics TO analytics_user;

-- Connect to bias detection database and create schema
\c pixelated_bias;

-- Bias detection tables
CREATE SCHEMA IF NOT EXISTS bias_detection;

CREATE TABLE IF NOT EXISTS bias_detection.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    participant_demographics JSONB,
    therapeutic_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bias_detection.analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES bias_detection.sessions(id),
    overall_bias_score DECIMAL(5,4),
    alert_level VARCHAR(20),
    layer_results JSONB,
    recommendations TEXT[],
    confidence DECIMAL(5,4),
    demographic_groups JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bias_detection.metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50),
    metric_value DECIMAL(10,4),
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bias_detection.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES bias_detection.sessions(id),
    alert_level VARCHAR(20),
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for better performance
CREATE INDEX idx_sessions_session_id ON bias_detection.sessions(session_id);
CREATE INDEX idx_analysis_results_session_id ON bias_detection.analysis_results(session_id);
CREATE INDEX idx_analysis_results_created_at ON bias_detection.analysis_results(created_at);
CREATE INDEX idx_metrics_type_timestamp ON bias_detection.metrics(metric_type, timestamp);
CREATE INDEX idx_alerts_level_created ON bias_detection.alerts(alert_level, created_at);

-- Connect to AI services database
\c pixelated_ai;

CREATE SCHEMA IF NOT EXISTS ai_service;

CREATE TABLE IF NOT EXISTS ai_service.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    model_type VARCHAR(100),
    messages JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_service.model_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES ai_service.conversations(id),
    prompt TEXT,
    response TEXT,
    model_used VARCHAR(100),
    tokens_used INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_service.emotional_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES ai_service.conversations(id),
    emotion_scores JSONB,
    sentiment_score DECIMAL(5,4),
    confidence DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON ai_service.conversations(user_id);
CREATE INDEX idx_model_responses_conversation_id ON ai_service.model_responses(conversation_id);
CREATE INDEX idx_emotional_analysis_conversation_id ON ai_service.emotional_analysis(conversation_id);

-- Connect to analytics database
\c pixelated_analytics;

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100),
    user_id UUID,
    session_id UUID,
    properties JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics.performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100),
    metric_name VARCHAR(100),
    metric_value DECIMAL(10,4),
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics.system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100),
    health_status VARCHAR(20),
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_type_timestamp ON analytics.events(event_type, timestamp);
CREATE INDEX idx_events_user_id ON analytics.events(user_id);
CREATE INDEX idx_performance_metrics_service_metric ON analytics.performance_metrics(service_name, metric_name);
CREATE INDEX idx_system_health_service_timestamp ON analytics.system_health(service_name, timestamp);

-- Return to main database
\c pixelated;
