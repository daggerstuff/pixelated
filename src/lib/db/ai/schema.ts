import type { Database } from '../../../types/supabase'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

// Create mock client for builds
function createMockClient() {
  console.warn(
    'Using mock Supabase client in AI schema module. This should not be used in production.',
  )
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
    from: (_table: string) => ({
      insert: () => Promise.resolve({ error: null }),
      select: () => ({
        eq: () => ({
          order: () => ({
            range: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
    rpc: () => Promise.resolve({ error: null }),
  }
}

// Use real client if credentials are available, otherwise use mock
export const supabase =
  supabaseUrl && supabaseKey
    ? createClient<Database>(supabaseUrl, supabaseKey)
    : (createMockClient() as unknown as SupabaseClient<Database>)

/**
 * Schema definitions for AI analysis tables
 * These are used for type checking and documentation
 */
export const AI_TABLES = {
  SENTIMENT_ANALYSIS: 'ai_sentiment_analysis',
  CRISIS_DETECTION: 'ai_crisis_detection',
  RESPONSE_GENERATION: 'ai_response_generation',
  INTERVENTION_ANALYSIS: 'ai_intervention_analysis',
  USAGE_STATS: 'ai_usage_stats',
  BIAS_ANALYSIS: 'ai_bias_analysis',
  BIAS_METRICS: 'ai_bias_metrics',
  BIAS_ALERTS: 'ai_bias_alerts',
  BIAS_REPORTS: 'ai_bias_reports',
} as const

/**
 * SQL for creating AI analysis tables
 * This can be used to initialize the database schema
 */
export const createAITablesSQL = `
-- Sentiment Analysis Results
CREATE TABLE IF NOT EXISTS ${AI_TABLES.SENTIMENT_ANALYSIS} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  text TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  score NUMERIC(5,4) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  metadata JSONB
);

-- Crisis Detection Results
CREATE TABLE IF NOT EXISTS ${AI_TABLES.CRISIS_DETECTION} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  text TEXT NOT NULL,
  crisis_detected BOOLEAN NOT NULL DEFAULT false,
  crisis_type TEXT,
  confidence NUMERIC(5,4) NOT NULL,
  risk_level TEXT NOT NULL,
  sensitivity_level INTEGER NOT NULL DEFAULT 5,
  metadata JSONB
);

-- Response Generation Results
CREATE TABLE IF NOT EXISTS ${AI_TABLES.RESPONSE_GENERATION} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  context TEXT,
  instructions TEXT,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 1000,
  metadata JSONB
);

-- Intervention Analysis Results
CREATE TABLE IF NOT EXISTS ${AI_TABLES.INTERVENTION_ANALYSIS} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  conversation TEXT NOT NULL,
  intervention TEXT NOT NULL,
  user_response TEXT NOT NULL,
  effectiveness NUMERIC(5,4) NOT NULL,
  insights TEXT NOT NULL,
  recommended_follow_up TEXT,
  metadata JSONB
);

-- Bias Analysis Results
CREATE TABLE IF NOT EXISTS ${AI_TABLES.BIAS_ANALYSIS} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_id TEXT NOT NULL DEFAULT 'bias-detection-v1',
  model_provider TEXT NOT NULL DEFAULT 'internal',
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  error TEXT,
  overall_bias_score NUMERIC(5,4) NOT NULL,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('low', 'medium', 'high', 'critical')),
  confidence_score NUMERIC(5,4) NOT NULL,
  layer_results JSONB NOT NULL,
  demographics JSONB,
  demographic_groups JSONB,
  recommendations TEXT[],
  explanation TEXT,
  metadata JSONB,
  UNIQUE(session_id, created_at)
);

-- Bias Analysis Metrics (aggregated)
CREATE TABLE IF NOT EXISTS ${AI_TABLES.BIAS_METRICS} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('bias_score', 'alert_level', 'analysis_type', 'response_time', 'demographic', 'performance')),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(10,4) NOT NULL,
  session_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  aggregation_period TEXT CHECK (aggregation_period IN ('hourly', 'daily', 'weekly', 'monthly')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bias Alert History
CREATE TABLE IF NOT EXISTS ${AI_TABLES.BIAS_ALERTS} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id TEXT NOT NULL UNIQUE,
  session_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('bias', 'system', 'performance', 'threshold')),
  alert_level TEXT NOT NULL CHECK (alert_level IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  details JSONB NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  actions JSONB DEFAULT '[]',
  notification_channels TEXT[],
  escalated BOOLEAN NOT NULL DEFAULT false,
  escalated_at TIMESTAMP WITH TIME ZONE
);

-- Bias Analysis Reports
CREATE TABLE IF NOT EXISTS ${AI_TABLES.BIAS_REPORTS} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT,
  time_range_start TIMESTAMP WITH TIME ZONE NOT NULL,
  time_range_end TIMESTAMP WITH TIME ZONE NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 0,
  format TEXT NOT NULL CHECK (format IN ('json', 'pdf', 'html', 'csv')),
  overall_fairness_score NUMERIC(5,4),
  average_bias_score NUMERIC(5,4),
  alert_distribution JSONB,
  aggregated_metrics JSONB,
  trend_analysis JSONB,
  custom_analysis JSONB,
  recommendations JSONB,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  file_path TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);

-- AI Usage Statistics
CREATE TABLE IF NOT EXISTS ${AI_TABLES.USAGE_STATS} (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  date DATE NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  model_usage JSONB NOT NULL DEFAULT '{}',
  UNIQUE(user_id, period, date)
);

-- Create indexes for bias analysis tables
CREATE INDEX IF NOT EXISTS idx_bias_analysis_session_id ON ${AI_TABLES.BIAS_ANALYSIS}(session_id);
CREATE INDEX IF NOT EXISTS idx_bias_analysis_user_id ON ${AI_TABLES.BIAS_ANALYSIS}(user_id);
CREATE INDEX IF NOT EXISTS idx_bias_analysis_created_at ON ${AI_TABLES.BIAS_ANALYSIS}(created_at);
CREATE INDEX IF NOT EXISTS idx_bias_analysis_alert_level ON ${AI_TABLES.BIAS_ANALYSIS}(alert_level);
CREATE INDEX IF NOT EXISTS idx_bias_analysis_bias_score ON ${AI_TABLES.BIAS_ANALYSIS}(overall_bias_score);

CREATE INDEX IF NOT EXISTS idx_bias_metrics_type_name ON ${AI_TABLES.BIAS_METRICS}(metric_type, metric_name);
CREATE INDEX IF NOT EXISTS idx_bias_metrics_timestamp ON ${AI_TABLES.BIAS_METRICS}(timestamp);
CREATE INDEX IF NOT EXISTS idx_bias_metrics_session_id ON ${AI_TABLES.BIAS_METRICS}(session_id);
CREATE INDEX IF NOT EXISTS idx_bias_metrics_user_id ON ${AI_TABLES.BIAS_METRICS}(user_id);
CREATE INDEX IF NOT EXISTS idx_bias_metrics_aggregation ON ${AI_TABLES.BIAS_METRICS}(aggregation_period, timestamp);

CREATE INDEX IF NOT EXISTS idx_bias_alerts_alert_id ON ${AI_TABLES.BIAS_ALERTS}(alert_id);
CREATE INDEX IF NOT EXISTS idx_bias_alerts_session_id ON ${AI_TABLES.BIAS_ALERTS}(session_id);
CREATE INDEX IF NOT EXISTS idx_bias_alerts_user_id ON ${AI_TABLES.BIAS_ALERTS}(user_id);
CREATE INDEX IF NOT EXISTS idx_bias_alerts_created_at ON ${AI_TABLES.BIAS_ALERTS}(created_at);
CREATE INDEX IF NOT EXISTS idx_bias_alerts_type_level ON ${AI_TABLES.BIAS_ALERTS}(alert_type, alert_level);
CREATE INDEX IF NOT EXISTS idx_bias_alerts_acknowledged ON ${AI_TABLES.BIAS_ALERTS}(acknowledged, resolved);

CREATE INDEX IF NOT EXISTS idx_bias_reports_report_id ON ${AI_TABLES.BIAS_REPORTS}(report_id);
CREATE INDEX IF NOT EXISTS idx_bias_reports_user_id ON ${AI_TABLES.BIAS_REPORTS}(user_id);
CREATE INDEX IF NOT EXISTS idx_bias_reports_created_at ON ${AI_TABLES.BIAS_REPORTS}(created_at);
CREATE INDEX IF NOT EXISTS idx_bias_reports_time_range ON ${AI_TABLES.BIAS_REPORTS}(time_range_start, time_range_end);

-- Add RLS policies
ALTER TABLE ${AI_TABLES.SENTIMENT_ANALYSIS} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${AI_TABLES.CRISIS_DETECTION} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${AI_TABLES.RESPONSE_GENERATION} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${AI_TABLES.INTERVENTION_ANALYSIS} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${AI_TABLES.USAGE_STATS} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${AI_TABLES.BIAS_ANALYSIS} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${AI_TABLES.BIAS_METRICS} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${AI_TABLES.BIAS_ALERTS} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${AI_TABLES.BIAS_REPORTS} ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view their own sentiment analysis"
  ON ${AI_TABLES.SENTIMENT_ANALYSIS} FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own crisis detection"
  ON ${AI_TABLES.CRISIS_DETECTION} FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own response generation"
  ON ${AI_TABLES.RESPONSE_GENERATION} FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own intervention analysis"
  ON ${AI_TABLES.INTERVENTION_ANALYSIS} FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage stats"
  ON ${AI_TABLES.USAGE_STATS} FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own bias analysis"
  ON ${AI_TABLES.BIAS_ANALYSIS} FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own bias metrics"
  ON ${AI_TABLES.BIAS_METRICS} FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own bias alerts"
  ON ${AI_TABLES.BIAS_ALERTS} FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own bias reports"
  ON ${AI_TABLES.BIAS_REPORTS} FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update data
CREATE POLICY "Service role can manage sentiment analysis"
  ON ${AI_TABLES.SENTIMENT_ANALYSIS} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage crisis detection"
  ON ${AI_TABLES.CRISIS_DETECTION} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage response generation"
  ON ${AI_TABLES.RESPONSE_GENERATION} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage intervention analysis"
  ON ${AI_TABLES.INTERVENTION_ANALYSIS} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage usage stats"
  ON ${AI_TABLES.USAGE_STATS} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage bias analysis"
  ON ${AI_TABLES.BIAS_ANALYSIS} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage bias metrics"
  ON ${AI_TABLES.BIAS_METRICS} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage bias alerts"
  ON ${AI_TABLES.BIAS_ALERTS} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage bias reports"
  ON ${AI_TABLES.BIAS_REPORTS} FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_bias_analysis_updated_at BEFORE UPDATE ON ${AI_TABLES.BIAS_ANALYSIS} FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bias_alerts_updated_at BEFORE UPDATE ON ${AI_TABLES.BIAS_ALERTS} FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bias_reports_updated_at BEFORE UPDATE ON ${AI_TABLES.BIAS_REPORTS} FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create materialized views for better query performance
CREATE MATERIALIZED VIEW bias_analysis_summary AS
SELECT
  DATE_TRUNC('day', created_at) as analysis_date,
  alert_level,
  COUNT(*) as analysis_count,
  AVG(overall_bias_score) as avg_bias_score,
  AVG(confidence_score) as avg_confidence_score,
  AVG(latency_ms) as avg_latency_ms
FROM ${AI_TABLES.BIAS_ANALYSIS}
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), alert_level;

CREATE UNIQUE INDEX ON bias_analysis_summary (analysis_date, alert_level);

CREATE MATERIALIZED VIEW bias_metrics_hourly AS
SELECT
  DATE_TRUNC('hour', timestamp) as metric_hour,
  metric_type,
  metric_name,
  COUNT(*) as metric_count,
  AVG(metric_value) as avg_value,
  MIN(metric_value) as min_value,
  MAX(metric_value) as max_value
FROM ${AI_TABLES.BIAS_METRICS}
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp), metric_type, metric_name;

CREATE UNIQUE INDEX ON bias_metrics_hourly (metric_hour, metric_type, metric_name);

-- Schedule materialized view refreshes
SELECT cron.schedule(
  'refresh-bias-analysis-summary',
  '0 */6 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY bias_analysis_summary$$
);

SELECT cron.schedule(
  'refresh-bias-metrics-hourly', 
  '30 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY bias_metrics_hourly$$
);

-- Clean up old data periodically
CREATE OR REPLACE FUNCTION cleanup_old_bias_data(retention_days integer)
RETURNS void AS $$
BEGIN
    -- Clean up old bias metrics (keep aggregated data longer)
    DELETE FROM ${AI_TABLES.BIAS_METRICS}
    WHERE created_at < NOW() - (retention_days || ' days')::interval
    AND aggregation_period IS NULL; -- Only delete raw metrics
    
    -- Clean up resolved bias alerts older than retention period
    DELETE FROM ${AI_TABLES.BIAS_ALERTS}
    WHERE created_at < NOW() - (retention_days || ' days')::interval
    AND resolved = true;
    
    -- Clean up expired reports
    DELETE FROM ${AI_TABLES.BIAS_REPORTS}
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    -- Refresh materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY bias_analysis_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY bias_metrics_hourly;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule(
  'cleanup-bias-data',
  '0 2 * * *',
  $$SELECT cleanup_old_bias_data(90)$$
);
`

/**
 * Initialize AI tables in the database
 */
export async function initializeAITables() {
  try {
    const { error } = await supabase.rpc('execute_sql', {
      sql: createAITablesSQL,
    })

    if (error) {
      console.error('Error initializing AI tables:', error)
      throw error
    }

    console.warn('AI tables initialized successfully')
    return true
  } catch (error) {
    console.error(
      'Failed to initialize AI tables:',
      error instanceof Error ? error : new Error(String(error)),
    )
    throw error instanceof Error ? error : new Error(String(error))
  }
}
