-- Business Intelligence Database Schema
-- This completes the Business Strategy CMS with real data storage

-- Market data storage
CREATE TABLE IF NOT EXISTS market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    company_name VARCHAR(255),
    price DECIMAL(15, 4),
    change_amount DECIMAL(15, 4),
    change_percent DECIMAL(8, 4),
    volume BIGINT,
    market_cap BIGINT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'yahoo_finance',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Competitor analysis
CREATE TABLE IF NOT EXISTS competitor_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    market_share DECIMAL(5, 2),
    revenue BIGINT,
    growth_rate DECIMAL(5, 2),
    key_products TEXT[],
    strengths TEXT[],
    weaknesses TEXT[],
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market opportunities
CREATE TABLE IF NOT EXISTS market_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    market_size BIGINT,
    growth_rate DECIMAL(5, 2),
    competition_level VARCHAR(20) CHECK (competition_level IN ('low', 'medium', 'high')),
    barriers TEXT[],
    opportunities TEXT[],
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
    estimated_roi DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business metrics for tracking KPIs
CREATE TABLE IF NOT EXISTS business_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    revenue BIGINT,
    growth_rate DECIMAL(5, 2),
    customer_acquisition_cost DECIMAL(10, 2),
    customer_lifetime_value DECIMAL(10, 2),
    churn_rate DECIMAL(5, 2),
    net_promoter_score INTEGER CHECK (net_promoter_score BETWEEN 0 AND 100),
    market_share DECIMAL(5, 2),
    employee_count INTEGER,
    quarter VARCHAR(2) CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
    year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, quarter, year)
);

-- Business alerts
CREATE TABLE IF NOT EXISTS business_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    type VARCHAR(20) CHECK (type IN ('market_change', 'competitor_activity', 'opportunity', 'risk')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    source VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days'
);

-- Industry analysis
CREATE TABLE IF NOT EXISTS industry_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry VARCHAR(100) NOT NULL,
    overview TEXT,
    growth_rate DECIMAL(5, 2),
    key_players TEXT[],
    market_size BIGINT,
    trends TEXT[],
    risks TEXT[],
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market forecasts
CREATE TABLE IF NOT EXISTS market_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    forecast_date DATE NOT NULL,
    predicted_price DECIMAL(15, 4),
    confidence DECIMAL(3, 2),
    trend VARCHAR(10) CHECK (trend IN ('up', 'down', 'stable')),
    source VARCHAR(50) DEFAULT 'ai_model',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol, forecast_date)
);

-- Company profiles for competitor tracking
CREATE TABLE IF NOT EXISTS company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    sector VARCHAR(100),
    market_cap BIGINT,
    revenue BIGINT,
    employees INTEGER,
    headquarters VARCHAR(255),
    website VARCHAR(255),
    description TEXT,
    founded_year INTEGER,
    ceo VARCHAR(255),
    key_metrics JSONB DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Financial news and events
CREATE TABLE IF NOT EXISTS financial_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    source VARCHAR(100),
    url TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    symbols TEXT[],
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    relevance_score DECIMAL(3, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Economic indicators
CREATE TABLE IF NOT EXISTS economic_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_name VARCHAR(100) NOT NULL,
    value DECIMAL(15, 4),
    unit VARCHAR(50),
    period VARCHAR(50),
    country VARCHAR(50),
    source VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences for alerts and notifications
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    industries TEXT[] DEFAULT '{}',
    symbols TEXT[] DEFAULT '{}',
    alert_types TEXT[] DEFAULT '{}',
    frequency VARCHAR(20) CHECK (frequency IN ('realtime', 'daily', 'weekly')),
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_market_data_company_name ON market_data(company_name);

CREATE INDEX IF NOT EXISTS idx_competitor_analysis_industry ON competitor_analysis(industry);
CREATE INDEX IF NOT EXISTS idx_competitor_analysis_company ON competitor_analysis(company);

CREATE INDEX IF NOT EXISTS idx_market_opportunities_industry ON market_opportunities(industry);
CREATE INDEX IF NOT EXISTS idx_market_opportunities_segment ON market_opportunities(segment);

CREATE INDEX IF NOT EXISTS idx_business_metrics_user_id ON business_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_business_metrics_quarter_year ON business_metrics(quarter, year);
CREATE INDEX IF NOT EXISTS idx_business_metrics_created_at ON business_metrics(created_at);

CREATE INDEX IF NOT EXISTS idx_business_alerts_user_id ON business_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_business_alerts_type ON business_alerts(type);
CREATE INDEX IF NOT EXISTS idx_business_alerts_severity ON business_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_business_alerts_created_at ON business_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_business_alerts_is_read ON business_alerts(is_read);

CREATE INDEX IF NOT EXISTS idx_industry_analysis_industry ON industry_analysis(industry);
CREATE INDEX IF NOT EXISTS idx_industry_analysis_last_updated ON industry_analysis(last_updated);

CREATE INDEX IF NOT EXISTS idx_market_forecasts_symbol ON market_forecasts(symbol);
CREATE INDEX IF NOT EXISTS idx_market_forecasts_date ON market_forecasts(forecast_date);

CREATE INDEX IF NOT EXISTS idx_company_profiles_symbol ON company_profiles(symbol);
CREATE INDEX IF NOT EXISTS idx_company_profiles_industry ON company_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_company_profiles_sector ON company_profiles(sector);

CREATE INDEX IF NOT EXISTS idx_financial_news_symbols ON financial_news USING GIN(symbols);
CREATE INDEX IF NOT EXISTS idx_financial_news_published_at ON financial_news(published_at);
CREATE INDEX IF NOT EXISTS idx_financial_news_sentiment ON financial_news(sentiment);

CREATE INDEX IF NOT EXISTS idx_economic_indicators_name ON economic_indicators(indicator_name);
CREATE INDEX IF NOT EXISTS idx_economic_indicators_country ON economic_indicators(country);
CREATE INDEX IF NOT EXISTS idx_economic_indicators_timestamp ON economic_indicators(timestamp);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_industries ON user_preferences USING GIN(industries);
CREATE INDEX IF NOT EXISTS idx_user_preferences_symbols ON user_preferences USING GIN(symbols);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_market_opportunities_updated_at BEFORE UPDATE ON market_opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_profiles_updated_at BEFORE UPDATE ON company_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired alerts
CREATE OR REPLACE FUNCTION cleanup_expired_alerts()
RETURNS INTEGER AS $$
BEGIN
    DELETE FROM business_alerts WHERE expires_at < NOW();
    RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate business health score
CREATE OR REPLACE FUNCTION calculate_business_health_score(user_id_param VARCHAR)
RETURNS TABLE (
    overall_score DECIMAL(5, 2),
    revenue_score DECIMAL(5, 2),
    growth_score DECIMAL(5, 2),
    retention_score DECIMAL(5, 2),
    market_score DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_metrics AS (
        SELECT * FROM business_metrics 
        WHERE user_id = user_id_param 
        ORDER BY year DESC, quarter DESC 
        LIMIT 1
    )
    SELECT 
        CASE 
            WHEN lm.revenue IS NULL THEN 0.0
            ELSE (
                CASE WHEN lm.growth_rate > 20 THEN 25.0 ELSE (lm.growth_rate / 20.0) * 25.0 END +
                CASE WHEN lm.churn_rate < 5 THEN 25.0 ELSE ((10 - lm.churn_rate) / 5.0) * 25.0 END +
                CASE WHEN lm.net_promoter_score > 70 THEN 25.0 ELSE (lm.net_promoter_score / 70.0) * 25.0 END +
                CASE WHEN lm.market_share > 10 THEN 25.0 ELSE (lm.market_share / 10.0) * 25.0 END
            )
        END as overall_score,
        CASE 
            WHEN lm.revenue IS NULL THEN 0.0
            ELSE CASE WHEN lm.revenue > 1000000 THEN 100.0 ELSE (lm.revenue / 1000000.0) * 100.0 END
        END as revenue_score,
        CASE 
            WHEN lm.growth_rate IS NULL THEN 0.0
            ELSE CASE WHEN lm.growth_rate > 20 THEN 100.0 ELSE (lm.growth_rate / 20.0) * 100.0 END
        END as growth_score,
        CASE 
            WHEN lm.churn_rate IS NULL THEN 0.0
            ELSE CASE WHEN lm.churn_rate < 5 THEN 100.0 ELSE ((10 - lm.churn_rate) / 5.0) * 100.0 END
        END as retention_score,
        CASE 
            WHEN lm.market_share IS NULL THEN 0.0
            ELSE CASE WHEN lm.market_share > 10 THEN 100.0 ELSE (lm.market_share / 10.0) * 100.0 END
        END as market_score
    FROM latest_metrics lm;
END;
$$ LANGUAGE plpgsql;