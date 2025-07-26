-- Create security monitoring tables
CREATE TABLE IF NOT EXISTS auth.security_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enhanced_security BOOLEAN DEFAULT false,
    security_level TEXT CHECK (security_level IN ('standard', 'high', 'maximum')) DEFAULT 'standard',
    notification_preferences JSONB DEFAULT '{
        "login_from_new_device": true,
        "password_changes": true,
        "failed_login_attempts": true,
        "suspicious_activity": true
    }'::jsonb,
    last_security_update TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON auth.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON auth.security_events(event_type);

-- Create function to configure auth policies
CREATE OR REPLACE FUNCTION auth.configure_auth_policies(
    max_login_attempts INTEGER,
    lockout_duration INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    -- Update auth settings in auth.config table
    INSERT INTO auth.config (
        key,
        value
    ) VALUES
    ('max_login_attempts', max_login_attempts::text),
    ('lockout_duration', lockout_duration::text)
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value;

    RETURN true;
END;
$$;

-- Create function to configure security templates
CREATE OR REPLACE FUNCTION auth.configure_security_templates()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    -- Configure email templates for security notifications
    -- Note: In production, you would integrate with your email service here
    -- This is a placeholder for the actual implementation
    RETURN true;
END;
$$;

-- Create function to set up user monitoring
CREATE OR REPLACE FUNCTION auth.setup_user_monitoring(
    user_id UUID,
    monitoring_config JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    -- Insert or update user's security settings
    INSERT INTO auth.security_settings (
        user_id,
        enhanced_security,
        security_level,
        notification_preferences
    ) VALUES (
        user_id,
        true,
        'high',
        monitoring_config
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        enhanced_security = true,
        security_level = 'high',
        notification_preferences = monitoring_config,
        updated_at = now();

    -- Log the monitoring setup
    INSERT INTO auth.security_events (
        user_id,
        event_type,
        event_data
    ) VALUES (
        user_id,
        'monitoring_setup',
        monitoring_config
    );

    RETURN true;
END;
$$;

-- Create function to test security alerts
CREATE OR REPLACE FUNCTION auth.test_security_alert(
    alert_type TEXT,
    is_test BOOLEAN DEFAULT true
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    IF NOT is_test THEN
        RAISE EXCEPTION 'This function can only be called in test mode';
    END IF;

    -- Log the test alert
    INSERT INTO auth.security_events (
        user_id,
        event_type,
        event_data
    ) VALUES (
        auth.uid(),
        'test_alert',
        jsonb_build_object(
            'alert_type', alert_type,
            'is_test', is_test
        )
    );

    RETURN true;
END;
$$;

-- Create function to update security monitoring
CREATE OR REPLACE FUNCTION auth.update_security_monitoring(
    user_id UUID,
    monitoring_config JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
    current_settings auth.security_settings%ROWTYPE;
BEGIN
    -- Get current settings
    SELECT * INTO current_settings
    FROM auth.security_settings
    WHERE security_settings.user_id = update_security_monitoring.user_id;

    -- Update security settings
    INSERT INTO auth.security_settings (
        user_id,
        enhanced_security,
        security_level,
        notification_preferences,
        updated_at
    ) VALUES (
        user_id,
        COALESCE((monitoring_config->>'enhanced_security')::boolean, true),
        COALESCE(monitoring_config->>'security_level', 'high'),
        monitoring_config,
        now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
        enhanced_security = COALESCE((EXCLUDED.notification_preferences->>'enhanced_security')::boolean, security_settings.enhanced_security),
        security_level = COALESCE(EXCLUDED.notification_preferences->>'security_level', security_settings.security_level),
        notification_preferences = EXCLUDED.notification_preferences,
        updated_at = EXCLUDED.updated_at;

    -- Log the update
    INSERT INTO auth.security_events (
        user_id,
        event_type,
        event_data
    ) VALUES (
        user_id,
        'monitoring_update',
        jsonb_build_object(
            'previous_config', current_settings.notification_preferences,
            'new_config', monitoring_config
        )
    );

    RETURN true;
END;
$$;

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION auth.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_security_settings_timestamp
    BEFORE UPDATE ON auth.security_settings
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_timestamp();

-- Create RLS policies
ALTER TABLE auth.security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.security_events ENABLE ROW LEVEL SECURITY;

-- Only allow users to view their own security settings
CREATE POLICY "Users can view their own security settings"
    ON auth.security_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only allow users to view their own security events
CREATE POLICY "Users can view their own security events"
    ON auth.security_events
    FOR SELECT
    USING (auth.uid() = user_id);

-- Only allow the security service role to insert/update security settings
CREATE POLICY "Security service can manage security settings"
    ON auth.security_settings
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Only allow the security service role to insert security events
CREATE POLICY "Security service can manage security events"
    ON auth.security_events
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
