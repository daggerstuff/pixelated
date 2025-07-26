# Supabase Database Setup Guide

This guide will help you set up your Supabase database from scratch. Follow these steps to restore your database schema and functionality.

## Prerequisites

- Access to your Supabase project dashboard
- Your Supabase URL and API keys
- Proper environment variables configured in `.env.local`

## Step 1: Create the exec_sql function

First, we need to create a helper function that allows us to execute raw SQL. Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/abbbyyegxkijbaadeenj/sql) and run:

```sql
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;
```

## Step 2: Run Database Migrations

Run each of these migration files in order through the SQL Editor:

### 1. Create AI Metrics Table

```sql
create table if not exists ai_metrics (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  model text not null,
  latency int not null,
  input_tokens int,
  output_tokens int,
  total_tokens int,
  success boolean not null default true,
  error_code text,
  cached boolean not null default false,
  optimized boolean not null default false,
  user_id uuid references auth.users(id),
  session_id uuid,
  request_id uuid not null
);

-- Create indexes for common queries
create index ai_metrics_occurred_at_idx on ai_metrics(occurred_at);
create index ai_metrics_model_idx on ai_metrics(model);
create index ai_metrics_user_id_idx on ai_metrics(user_id);

-- Enable RLS
alter table ai_metrics enable row level security;

-- Create policies
create policy "Admins can do everything" on ai_metrics
  for all using (
    auth.role() = 'admin'
  );

create policy "Users can view their own metrics" on ai_metrics
  for select using (
    auth.uid() = user_id
  );
```

### 2. Create Security Functions

```sql
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
```

### 3. Create Security Email Templates

```sql
-- Create email templates table
CREATE TABLE IF NOT EXISTS auth.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trigger for updating timestamps
CREATE TRIGGER update_email_templates_timestamp
    BEFORE UPDATE ON auth.email_templates
    FOR EACH ROW
    EXECUTE FUNCTION auth.update_timestamp();

-- Insert security email templates (see migration file for full templates)
```

## Step 3: Create Core Tables

Now create the core application tables that are defined in your TypeScript types:

```sql
-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  role TEXT DEFAULT 'user' NOT NULL
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  metadata JSONB,
  last_message_at TIMESTAMP WITH TIME ZONE
);

-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  role TEXT NOT NULL,
  metadata JSONB,
  sentiment_score NUMERIC,
  is_flagged BOOLEAN DEFAULT false NOT NULL
);

-- AI Usage Logs Table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0 NOT NULL,
  output_tokens INTEGER DEFAULT 0 NOT NULL,
  total_tokens INTEGER DEFAULT 0 NOT NULL,
  cost NUMERIC DEFAULT 0 NOT NULL
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  theme TEXT DEFAULT 'light' NOT NULL,
  notifications_enabled BOOLEAN DEFAULT true NOT NULL,
  email_notifications BOOLEAN DEFAULT true NOT NULL,
  language TEXT DEFAULT 'en' NOT NULL,
  preferences JSONB
);

-- AI Sentiment Analysis Table
CREATE TABLE IF NOT EXISTS public.ai_sentiment_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  model_id TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  request_tokens INTEGER DEFAULT 0 NOT NULL,
  response_tokens INTEGER DEFAULT 0 NOT NULL,
  total_tokens INTEGER DEFAULT 0 NOT NULL,
  latency_ms INTEGER DEFAULT 0 NOT NULL,
  success BOOLEAN DEFAULT true NOT NULL,
  error TEXT,
  text TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  score NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  metadata JSONB
);

-- Create remaining tables from types/supabase.ts
```

## Step 4: Set Up RLS Policies

Apply these Row Level Security (RLS) policies:

```sql
-- Enable RLS on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own conversations"
  ON public.conversations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.conversations WHERE id = conversation_id));

CREATE POLICY "Users can insert messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.conversations WHERE id = conversation_id));

CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own usage logs"
  ON public.ai_usage_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);
```

## Step 5: Create the Optimizations

Run these optimizations to improve database performance:

```sql
-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- Add indexes for conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated_at ON public.conversations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at);

-- Add indexes for messages table
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_flagged ON public.messages(is_flagged);

-- Add indexes for AI usage tables
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON public.ai_usage_logs(model);

-- Add indexes for audit tables
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Optimize vacuum settings for frequently updated tables
ALTER TABLE public.messages SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.conversations SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE public.ai_usage_logs SET (autovacuum_vacuum_scale_factor = 0.05);

-- Set up text search capabilities for messages
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON public.messages USING GIN (content gin_trgm_ops);

-- Add filter for conversation search
CREATE INDEX IF NOT EXISTS idx_conversations_title_trgm ON public.conversations USING GIN (title gin_trgm_ops);
```

## Step 6: Set Up Storage Buckets

Run the following script to create the required storage buckets:

```bash
node supabase/setup-storage.js
```

## Verifying Your Setup

Run the test connection script to verify everything is working correctly:

```bash
node supabase/test-connection.js
```

If you encounter any issues, check the error messages and revisit the corresponding step.
