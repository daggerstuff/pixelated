-- Migration: Create crisis session flagging system
-- This migration creates tables and functions for flagging user sessions during crisis events

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types for crisis session flagging
CREATE TYPE crisis_flag_status AS ENUM (
  'pending',
  'under_review',
  'reviewed',
  'resolved',
  'escalated',
  'dismissed'
);

CREATE TYPE crisis_severity AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Create crisis_session_flags table
CREATE TABLE public.crisis_session_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL, -- Can be external session ID or internal
  crisis_id UUID NOT NULL UNIQUE, -- Unique identifier for this crisis event
  
  -- Crisis details
  reason TEXT NOT NULL,
  severity crisis_severity NOT NULL DEFAULT 'medium',
  confidence DECIMAL(5,4) CHECK (confidence >= 0 AND confidence <= 1),
  detected_risks TEXT[] NOT NULL DEFAULT '{}',
  text_sample TEXT,
  
  -- Status and workflow
  status crisis_flag_status NOT NULL DEFAULT 'pending',
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Staff assignment and notes
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  resolution_notes TEXT,
  
  -- Metadata and context
  routing_decision JSONB, -- Store the routing decision that led to flagging
  metadata JSONB DEFAULT '{}',
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create change history table for crisis_session_flags audit and point-in-time recovery
CREATE TABLE public.crisis_session_flags_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Original record data (mirroring all columns from crisis_session_flags)
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  crisis_id UUID NOT NULL,
  reason TEXT NOT NULL,
  severity crisis_severity NOT NULL,
  confidence DECIMAL(5,4),
  detected_risks TEXT[] NOT NULL,
  text_sample TEXT,
  status crisis_flag_status NOT NULL,
  flagged_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  assigned_to UUID,
  reviewer_notes TEXT,
  resolution_notes TEXT,
  routing_decision JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  
  -- Operation metadata
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  operation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation_user_agent TEXT,
  operation_ip_address TEXT,
  
  -- Change tracking
  changed_fields TEXT[], -- Array of field names that changed (for UPDATE operations)
  old_values JSONB, -- Previous values (for UPDATE operations)
  new_values JSONB  -- New values (for INSERT/UPDATE operations)
);

-- Create change history table for user_session_status audit and point-in-time recovery
CREATE TABLE public.user_session_status_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Original record data (mirroring all columns from user_session_status)
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  is_flagged_for_review BOOLEAN NOT NULL,
  current_risk_level crisis_severity,
  last_crisis_event_at TIMESTAMPTZ,
  total_crisis_flags INTEGER NOT NULL,
  active_crisis_flags INTEGER NOT NULL,
  resolved_crisis_flags INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  
  -- Operation metadata
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  operation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  operation_user_agent TEXT,
  operation_ip_address TEXT,
  
  -- Change tracking
  changed_fields TEXT[], -- Array of field names that changed (for UPDATE operations)
  old_values JSONB, -- Previous values (for UPDATE operations)
  new_values JSONB  -- New values (for INSERT/UPDATE operations)
);

-- Create user_session_status table for tracking overall user status
CREATE TABLE public.user_session_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Current status
  is_flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  current_risk_level crisis_severity DEFAULT 'low',
  last_crisis_event_at TIMESTAMPTZ,
  
  -- Counters
  total_crisis_flags INTEGER NOT NULL DEFAULT 0,
  active_crisis_flags INTEGER NOT NULL DEFAULT 0,
  resolved_crisis_flags INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger function for crisis_session_flags change history
CREATE OR REPLACE FUNCTION public.track_crisis_session_flags_changes()
RETURNS TRIGGER AS $$
DECLARE
  operation_user_id UUID;
  operation_user_agent TEXT;
  operation_ip_address TEXT;
  changed_fields TEXT[] := '{}';
  old_values JSONB := '{}';
  new_values JSONB := '{}';
  field_name TEXT;
  field_names TEXT[] := ARRAY['user_id', 'session_id', 'crisis_id', 'reason', 'severity', 
                               'confidence', 'detected_risks', 'text_sample', 'status', 
                               'flagged_at', 'reviewed_at', 'resolved_at', 'assigned_to', 
                               'reviewer_notes', 'resolution_notes', 'routing_decision', 'metadata'];
BEGIN
  -- Get current user context (if available)
  BEGIN
    operation_user_id := nullif(current_setting('app.current_user_id', true), '')::UUID;
  EXCEPTION
    WHEN OTHERS THEN
      operation_user_id := auth.uid();
  END;
  
  -- Get user agent and IP (if available from application context)
  BEGIN
    operation_user_agent := current_setting('app.user_agent', true);
  EXCEPTION
    WHEN OTHERS THEN
      operation_user_agent := NULL;
  END;
  
  BEGIN
    operation_ip_address := current_setting('app.client_ip', true);
  EXCEPTION
    WHEN OTHERS THEN
      operation_ip_address := NULL;
  END;
  
  -- For UPDATE operations, identify changed fields
  IF TG_OP = 'UPDATE' THEN
    FOREACH field_name IN ARRAY field_names LOOP
      -- Use row_to_json to compare field values
      IF (row_to_json(OLD)->>field_name) IS DISTINCT FROM (row_to_json(NEW)->>field_name) THEN
        changed_fields := array_append(changed_fields, field_name);
        old_values := old_values || jsonb_build_object(field_name, row_to_json(OLD)->>field_name);
        new_values := new_values || jsonb_build_object(field_name, row_to_json(NEW)->>field_name);
      END IF;
    END LOOP;
  END IF;
  
  -- For INSERT operations, capture all new values
  IF TG_OP = 'INSERT' THEN
    new_values := row_to_json(NEW)::JSONB;
  END IF;
  
  -- For DELETE operations, capture all old values
  IF TG_OP = 'DELETE' THEN
    old_values := row_to_json(OLD)::JSONB;
  END IF;
  
  -- Insert history record
  INSERT INTO public.crisis_session_flags_history (
    id, user_id, session_id, crisis_id, reason, severity, confidence, detected_risks,
    text_sample, status, flagged_at, reviewed_at, resolved_at, assigned_to,
    reviewer_notes, resolution_notes, routing_decision, metadata, created_at, updated_at,
    operation, operation_user_id, operation_user_agent, operation_ip_address,
    changed_fields, old_values, new_values
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.session_id, OLD.session_id),
    COALESCE(NEW.crisis_id, OLD.crisis_id),
    COALESCE(NEW.reason, OLD.reason),
    COALESCE(NEW.severity, OLD.severity),
    COALESCE(NEW.confidence, OLD.confidence),
    COALESCE(NEW.detected_risks, OLD.detected_risks),
    COALESCE(NEW.text_sample, OLD.text_sample),
    COALESCE(NEW.status, OLD.status),
    COALESCE(NEW.flagged_at, OLD.flagged_at),
    COALESCE(NEW.reviewed_at, OLD.reviewed_at),
    COALESCE(NEW.resolved_at, OLD.resolved_at),
    COALESCE(NEW.assigned_to, OLD.assigned_to),
    COALESCE(NEW.reviewer_notes, OLD.reviewer_notes),
    COALESCE(NEW.resolution_notes, OLD.resolution_notes),
    COALESCE(NEW.routing_decision, OLD.routing_decision),
    COALESCE(NEW.metadata, OLD.metadata),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.updated_at, OLD.updated_at),
    TG_OP,
    operation_user_id,
    operation_user_agent,
    operation_ip_address,
    changed_fields,
    old_values,
    new_values
  );
  
  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Trigger function for user_session_status change history
CREATE OR REPLACE FUNCTION public.track_user_session_status_changes()
RETURNS TRIGGER AS $$
DECLARE
  operation_user_id UUID;
  operation_user_agent TEXT;
  operation_ip_address TEXT;
  changed_fields TEXT[] := '{}';
  old_values JSONB := '{}';
  new_values JSONB := '{}';
  field_name TEXT;
  field_names TEXT[] := ARRAY['user_id', 'is_flagged_for_review', 'current_risk_level', 
                               'last_crisis_event_at', 'total_crisis_flags', 'active_crisis_flags', 
                               'resolved_crisis_flags', 'metadata'];
BEGIN
  -- Get current user context (if available)
  BEGIN
    operation_user_id := nullif(current_setting('app.current_user_id', true), '')::UUID;
  EXCEPTION
    WHEN OTHERS THEN
      operation_user_id := auth.uid();
  END;
  
  -- Get user agent and IP (if available from application context)
  BEGIN
    operation_user_agent := current_setting('app.user_agent', true);
  EXCEPTION
    WHEN OTHERS THEN
      operation_user_agent := NULL;
  END;
  
  BEGIN
    operation_ip_address := current_setting('app.client_ip', true);
  EXCEPTION
    WHEN OTHERS THEN
      operation_ip_address := NULL;
  END;
  
  -- For UPDATE operations, identify changed fields
  IF TG_OP = 'UPDATE' THEN
    FOREACH field_name IN ARRAY field_names LOOP
      -- Use row_to_json to compare field values
      IF (row_to_json(OLD)->>field_name) IS DISTINCT FROM (row_to_json(NEW)->>field_name) THEN
        changed_fields := array_append(changed_fields, field_name);
        old_values := old_values || jsonb_build_object(field_name, row_to_json(OLD)->>field_name);
        new_values := new_values || jsonb_build_object(field_name, row_to_json(NEW)->>field_name);
      END IF;
    END LOOP;
  END IF;
  
  -- For INSERT operations, capture all new values
  IF TG_OP = 'INSERT' THEN
    new_values := row_to_json(NEW)::JSONB;
  END IF;
  
  -- For DELETE operations, capture all old values
  IF TG_OP = 'DELETE' THEN
    old_values := row_to_json(OLD)::JSONB;
  END IF;
  
  -- Insert history record
  INSERT INTO public.user_session_status_history (
    id, user_id, is_flagged_for_review, current_risk_level, last_crisis_event_at,
    total_crisis_flags, active_crisis_flags, resolved_crisis_flags, metadata,
    created_at, updated_at, operation, operation_user_id, operation_user_agent,
    operation_ip_address, changed_fields, old_values, new_values
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.is_flagged_for_review, OLD.is_flagged_for_review),
    COALESCE(NEW.current_risk_level, OLD.current_risk_level),
    COALESCE(NEW.last_crisis_event_at, OLD.last_crisis_event_at),
    COALESCE(NEW.total_crisis_flags, OLD.total_crisis_flags),
    COALESCE(NEW.active_crisis_flags, OLD.active_crisis_flags),
    COALESCE(NEW.resolved_crisis_flags, OLD.resolved_crisis_flags),
    COALESCE(NEW.metadata, OLD.metadata),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.updated_at, OLD.updated_at),
    TG_OP,
    operation_user_id,
    operation_user_agent,
    operation_ip_address,
    changed_fields,
    old_values,
    new_values
  );
  
  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Enable RLS on both tables
ALTER TABLE public.crisis_session_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_session_status ENABLE ROW LEVEL SECURITY;

-- Create function to update updated_at timestamp (reuse existing if available)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Create triggers for updated_at timestamps
CREATE TRIGGER set_crisis_session_flags_updated_at
BEFORE UPDATE ON public.crisis_session_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_user_session_status_updated_at
BEFORE UPDATE ON public.user_session_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update user session status when crisis flags change
CREATE OR REPLACE FUNCTION public.update_user_session_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user session status
  INSERT INTO public.user_session_status (user_id, is_flagged_for_review, current_risk_level, last_crisis_event_at, total_crisis_flags, active_crisis_flags)
  VALUES (
    NEW.user_id,
    TRUE,
    NEW.severity,
    NEW.flagged_at,
    1,
    1
  )
  ON CONFLICT (user_id) DO UPDATE SET
    is_flagged_for_review = CASE 
      WHEN NEW.status IN ('pending', 'under_review', 'escalated') THEN TRUE
      ELSE (SELECT COUNT(*) > 0 FROM public.crisis_session_flags 
            WHERE user_id = NEW.user_id AND status IN ('pending', 'under_review', 'escalated'))
    END,
    current_risk_level = GREATEST(user_session_status.current_risk_level, NEW.severity),
    last_crisis_event_at = GREATEST(user_session_status.last_crisis_event_at, NEW.flagged_at),
    total_crisis_flags = user_session_status.total_crisis_flags + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE 0 END,
    active_crisis_flags = (
      SELECT COUNT(*) FROM public.crisis_session_flags 
      WHERE user_id = NEW.user_id AND status IN ('pending', 'under_review', 'escalated')
    ),
    resolved_crisis_flags = (
      SELECT COUNT(*) FROM public.crisis_session_flags 
      WHERE user_id = NEW.user_id AND status IN ('reviewed', 'resolved', 'dismissed')
    ),
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Create trigger to update user session status
CREATE TRIGGER update_user_session_status_trigger
AFTER INSERT OR UPDATE ON public.crisis_session_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_user_session_status();

-- Create indexes for performance
CREATE INDEX idx_crisis_session_flags_user_id ON public.crisis_session_flags(user_id);
CREATE INDEX idx_crisis_session_flags_session_id ON public.crisis_session_flags(session_id);
CREATE INDEX idx_crisis_session_flags_crisis_id ON public.crisis_session_flags(crisis_id);
CREATE INDEX idx_crisis_session_flags_status ON public.crisis_session_flags(status);
CREATE INDEX idx_crisis_session_flags_severity ON public.crisis_session_flags(severity);
CREATE INDEX idx_crisis_session_flags_flagged_at ON public.crisis_session_flags(flagged_at);
CREATE INDEX idx_crisis_session_flags_assigned_to ON public.crisis_session_flags(assigned_to);

CREATE INDEX idx_user_session_status_user_id ON public.user_session_status(user_id);
CREATE INDEX idx_user_session_status_flagged ON public.user_session_status(is_flagged_for_review);
CREATE INDEX idx_user_session_status_risk_level ON public.user_session_status(current_risk_level);

-- Additional RLS policies for history tables (audit trail access)
ALTER TABLE public.crisis_session_flags_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_session_status_history ENABLE ROW LEVEL SECURITY;

-- History table policies - read-only for users, full access for system
CREATE POLICY "Users can view their own crisis flags history" ON public.crisis_session_flags_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and therapists can view all crisis flags history" ON public.crisis_session_flags_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'therapist')
    )
  );

CREATE POLICY "System can manage crisis flags history" ON public.crisis_session_flags_history
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own session status history" ON public.user_session_status_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and therapists can view all session status history" ON public.user_session_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'therapist')
    )
  );

CREATE POLICY "System can manage session status history" ON public.user_session_status_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create the actual history tracking triggers
CREATE TRIGGER crisis_session_flags_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.crisis_session_flags
  FOR EACH ROW EXECUTE FUNCTION public.track_crisis_session_flags_changes();

CREATE TRIGGER user_session_status_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_session_status
  FOR EACH ROW EXECUTE FUNCTION public.track_user_session_status_changes();

-- Additional performance indexes for history tables
CREATE INDEX idx_crisis_flags_history_record_id ON public.crisis_session_flags_history(id);
CREATE INDEX idx_crisis_flags_history_user_id ON public.crisis_session_flags_history(user_id);
CREATE INDEX idx_crisis_flags_history_operation ON public.crisis_session_flags_history(operation);
CREATE INDEX idx_crisis_flags_history_operation_timestamp ON public.crisis_session_flags_history(operation_timestamp);
CREATE INDEX idx_crisis_flags_history_operation_user ON public.crisis_session_flags_history(operation_user_id) WHERE operation_user_id IS NOT NULL;
-- Composite index for point-in-time recovery queries
CREATE INDEX idx_crisis_flags_history_pitr ON public.crisis_session_flags_history(id, operation_timestamp DESC);

CREATE INDEX idx_session_status_history_record_id ON public.user_session_status_history(id);
CREATE INDEX idx_session_status_history_user_id ON public.user_session_status_history(user_id);
CREATE INDEX idx_session_status_history_operation ON public.user_session_status_history(operation);
CREATE INDEX idx_session_status_history_operation_timestamp ON public.user_session_status_history(operation_timestamp);
CREATE INDEX idx_session_status_history_operation_user ON public.user_session_status_history(operation_user_id) WHERE operation_user_id IS NOT NULL;
-- Composite index for point-in-time recovery queries
CREATE INDEX idx_session_status_history_pitr ON public.user_session_status_history(id, operation_timestamp DESC);

-- Point-in-Time Recovery utility function
CREATE OR REPLACE FUNCTION public.get_record_at_timestamp(
  p_table_name TEXT,
  p_record_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
DECLARE
  result JSONB;
  history_table TEXT;
  query_text TEXT;
BEGIN
  -- Determine the history table name
  history_table := p_table_name || '_history';
  
  -- Validate table names to prevent SQL injection
  IF p_table_name NOT IN ('crisis_session_flags', 'user_session_status') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  -- Query the history table for the most recent record before the timestamp
  query_text := format(
    'SELECT new_values FROM public.%I 
     WHERE id = $1 AND operation_timestamp <= $2 AND operation != ''DELETE''
     ORDER BY operation_timestamp DESC LIMIT 1',
    history_table
  );
  
  EXECUTE query_text INTO result USING p_record_id, p_timestamp;
  
  -- If no history found, try to get the current record if it was created before the timestamp
  IF result IS NULL THEN
    query_text := format(
      'SELECT row_to_json(t)::JSONB FROM public.%I t 
       WHERE id = $1 AND created_at <= $2',
      p_table_name
    );
    
    EXECUTE query_text INTO result USING p_record_id, p_timestamp;
  END IF;
  
  RETURN result;
END;
$$;

-- Function to get all changes for a record within a time range
CREATE OR REPLACE FUNCTION public.get_record_change_history(
  p_table_name TEXT,
  p_record_id UUID,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  operation_timestamp TIMESTAMPTZ,
  operation TEXT,
  operation_user_id UUID,
  changed_fields TEXT[],
  old_values JSONB,
  new_values JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
DECLARE
  history_table TEXT;
  query_text TEXT;
BEGIN
  -- Determine the history table name
  history_table := p_table_name || '_history';
  
  -- Validate table names to prevent SQL injection
  IF p_table_name NOT IN ('crisis_session_flags', 'user_session_status') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  -- Build the query
  query_text := format(
    'SELECT 
       operation_timestamp,
       operation,
       operation_user_id,
       changed_fields,
       old_values,
       new_values
     FROM public.%I 
     WHERE id = $1',
    history_table
  );
  
  -- Add time range conditions
  IF p_start_time IS NOT NULL THEN
    query_text := query_text || ' AND operation_timestamp >= $3';
  END IF;
  
  query_text := query_text || ' AND operation_timestamp <= $2 ORDER BY operation_timestamp DESC';
  
  -- Execute the query
  IF p_start_time IS NOT NULL THEN
    RETURN QUERY EXECUTE query_text USING p_record_id, p_end_time, p_start_time;
  ELSE
    RETURN QUERY EXECUTE query_text USING p_record_id, p_end_time;
  END IF;
END;
$$;

-- Comments for audit and PITR functions
COMMENT ON FUNCTION public.get_record_at_timestamp IS 'Retrieve the state of a record at a specific point in time for audit/recovery purposes';
COMMENT ON FUNCTION public.get_record_change_history IS 'Get complete change history for a record within a time range';

-- Comments for history tables
COMMENT ON TABLE public.crisis_session_flags_history IS 'Audit trail and point-in-time recovery for crisis_session_flags table';
COMMENT ON TABLE public.user_session_status_history IS 'Audit trail and point-in-time recovery for user_session_status table';
COMMENT ON COLUMN public.crisis_session_flags_history.operation IS 'Database operation that caused this history entry (INSERT, UPDATE, DELETE)';
COMMENT ON COLUMN public.crisis_session_flags_history.changed_fields IS 'Array of field names that were modified in UPDATE operations';
COMMENT ON COLUMN public.crisis_session_flags_history.old_values IS 'Previous values for changed fields (UPDATE/DELETE operations)';
COMMENT ON COLUMN public.crisis_session_flags_history.new_values IS 'New values for changed fields (INSERT/UPDATE operations)';

-- Utility functions for crisis session management

-- Function to get crisis flags summary statistics
CREATE OR REPLACE FUNCTION public.get_crisis_flags_summary(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  total_flags INTEGER,
  pending_flags INTEGER,
  resolved_flags INTEGER,
  high_severity_flags INTEGER,
  critical_severity_flags INTEGER,
  avg_resolution_time_hours NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
  SELECT 
    COUNT(*)::INTEGER as total_flags,
    COUNT(*) FILTER (WHERE status IN ('pending', 'under_review'))::INTEGER as pending_flags,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'dismissed'))::INTEGER as resolved_flags,
    COUNT(*) FILTER (WHERE severity = 'high')::INTEGER as high_severity_flags,
    COUNT(*) FILTER (WHERE severity = 'critical')::INTEGER as critical_severity_flags,
    ROUND(
      AVG(
        CASE 
          WHEN resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - flagged_at)) / 3600 
          ELSE NULL 
        END
      )::NUMERIC, 
      2
    ) as avg_resolution_time_hours
  FROM public.crisis_session_flags 
  WHERE flagged_at BETWEEN p_start_date AND p_end_date;
$$;

-- Function to escalate crisis flags based on age and severity
CREATE OR REPLACE FUNCTION public.escalate_stale_crisis_flags(
  p_max_pending_hours INTEGER DEFAULT 4,
  p_max_review_hours INTEGER DEFAULT 24
)
RETURNS TABLE(escalated_flag_id UUID, previous_status TEXT, new_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Escalate pending flags that are too old
  UPDATE public.crisis_session_flags 
  SET 
    status = 'escalated',
    updated_at = NOW(),
    reviewer_notes = COALESCE(reviewer_notes, '') || 
      CASE 
        WHEN reviewer_notes IS NOT NULL AND reviewer_notes != '' 
        THEN E'\n[SYSTEM] Escalated due to ' || p_max_pending_hours || ' hour timeout on ' || NOW()::DATE
        ELSE '[SYSTEM] Escalated due to ' || p_max_pending_hours || ' hour timeout on ' || NOW()::DATE
      END
  WHERE status = 'pending' 
    AND flagged_at < NOW() - (p_max_pending_hours || ' hours')::INTERVAL
    AND (severity IN ('high', 'critical') OR flagged_at < NOW() - (p_max_pending_hours * 2 || ' hours')::INTERVAL);

  -- Escalate under_review flags that are too old
  UPDATE public.crisis_session_flags 
  SET 
    status = 'escalated',
    updated_at = NOW(),
    reviewer_notes = COALESCE(reviewer_notes, '') || 
      CASE 
        WHEN reviewer_notes IS NOT NULL AND reviewer_notes != '' 
        THEN E'\n[SYSTEM] Escalated due to ' || p_max_review_hours || ' hour review timeout on ' || NOW()::DATE
        ELSE '[SYSTEM] Escalated due to ' || p_max_review_hours || ' hour review timeout on ' || NOW()::DATE
      END
  WHERE status = 'under_review' 
    AND flagged_at < NOW() - (p_max_review_hours || ' hours')::INTERVAL;

  -- Return information about escalated flags
  RETURN QUERY
  SELECT 
    id as escalated_flag_id,
    'pending/under_review'::TEXT as previous_status,
    'escalated'::TEXT as new_status
  FROM public.crisis_session_flags 
  WHERE status = 'escalated' 
    AND updated_at > NOW() - INTERVAL '1 minute';
END;
$$;

-- Function to get users requiring immediate attention
CREATE OR REPLACE FUNCTION public.get_users_requiring_attention(
  p_max_active_flags INTEGER DEFAULT 5,
  p_min_risk_level crisis_severity DEFAULT 'medium'
)
RETURNS TABLE(
  user_id UUID,
  is_flagged_for_review BOOLEAN,
  current_risk_level crisis_severity,
  active_crisis_flags INTEGER,
  last_crisis_event_at TIMESTAMPTZ,
  most_recent_flag_reason TEXT,
  priority_score INTEGER
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
  WITH priority_calculation AS (
    SELECT 
      uss.*,
      csf.reason as most_recent_flag_reason,
      -- Calculate priority score based on risk level, active flags, and recency
      CASE uss.current_risk_level
        WHEN 'critical' THEN 100
        WHEN 'high' THEN 75
        WHEN 'medium' THEN 50
        WHEN 'low' THEN 25
        ELSE 0
      END +
      (uss.active_crisis_flags * 10) +
      CASE 
        WHEN uss.last_crisis_event_at > NOW() - INTERVAL '1 hour' THEN 20
        WHEN uss.last_crisis_event_at > NOW() - INTERVAL '6 hours' THEN 10
        WHEN uss.last_crisis_event_at > NOW() - INTERVAL '24 hours' THEN 5
        ELSE 0
      END as priority_score
    FROM public.user_session_status uss
    LEFT JOIN LATERAL (
      SELECT reason
      FROM public.crisis_session_flags csf_inner
      WHERE csf_inner.user_id = uss.user_id
      ORDER BY csf_inner.flagged_at DESC
      LIMIT 1
    ) csf ON true
    WHERE 
      uss.is_flagged_for_review = true
      AND uss.current_risk_level >= p_min_risk_level
      AND (p_max_active_flags IS NULL OR uss.active_crisis_flags <= p_max_active_flags)
  )
  SELECT 
    pc.user_id,
    pc.is_flagged_for_review,
    pc.current_risk_level,
    pc.active_crisis_flags,
    pc.last_crisis_event_at,
    pc.most_recent_flag_reason,
    pc.priority_score
  FROM priority_calculation pc
  ORDER BY pc.priority_score DESC, pc.last_crisis_event_at DESC;
$$;

-- Function to clean up old resolved crisis flags
CREATE OR REPLACE FUNCTION public.cleanup_old_crisis_flags(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete old resolved/dismissed flags beyond retention period
  DELETE FROM public.crisis_session_flags 
  WHERE status IN ('resolved', 'dismissed')
    AND resolved_at < NOW() - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- Function to validate crisis flag data before insertion/update
CREATE OR REPLACE FUNCTION public.validate_crisis_flag_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate severity vs confidence correlation
  IF NEW.severity = 'critical' AND NEW.confidence < 0.7 THEN
    RAISE EXCEPTION 'Critical severity flags must have confidence >= 0.7, got %', NEW.confidence;
  END IF;
  
  IF NEW.severity = 'high' AND NEW.confidence < 0.5 THEN
    RAISE EXCEPTION 'High severity flags must have confidence >= 0.5, got %', NEW.confidence;
  END IF;
  
  -- Validate detected_risks is not empty for high/critical severity
  IF NEW.severity IN ('high', 'critical') AND array_length(NEW.detected_risks, 1) IS NULL THEN
    RAISE EXCEPTION 'High and critical severity flags must have at least one detected risk';
  END IF;
  
  -- Validate status transitions
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Validate valid status transitions
    CASE OLD.status
      WHEN 'pending' THEN
        IF NEW.status NOT IN ('under_review', 'dismissed', 'escalated') THEN
          RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
        END IF;
      WHEN 'under_review' THEN
        IF NEW.status NOT IN ('reviewed', 'resolved', 'escalated', 'dismissed') THEN
          RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
        END IF;
      WHEN 'reviewed' THEN
        IF NEW.status NOT IN ('resolved', 'escalated') THEN
          RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
        END IF;
      WHEN 'escalated' THEN
        IF NEW.status NOT IN ('under_review', 'resolved') THEN
          RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
        END IF;
      WHEN 'resolved' THEN
        -- Resolved flags should not be updated (except by system cleanup)
        IF NEW.status != 'resolved' THEN
          RAISE EXCEPTION 'Cannot change status of resolved crisis flag';
        END IF;
      WHEN 'dismissed' THEN
        -- Dismissed flags should not be updated
        IF NEW.status != 'dismissed' THEN
          RAISE EXCEPTION 'Cannot change status of dismissed crisis flag';
        END IF;
    END CASE;
    
    -- Set appropriate timestamps based on new status
    IF NEW.status = 'under_review' AND OLD.status = 'pending' THEN
      NEW.reviewed_at = NOW();
    END IF;
    
    IF NEW.status IN ('resolved', 'dismissed') AND OLD.status != NEW.status THEN
      NEW.resolved_at = NOW();
      NEW.reviewed_at = COALESCE(NEW.reviewed_at, NOW());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

-- Create validation trigger
CREATE TRIGGER validate_crisis_flag_data_trigger
  BEFORE INSERT OR UPDATE ON public.crisis_session_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_crisis_flag_data();

-- Create function to get flag statistics by user
CREATE OR REPLACE FUNCTION public.get_user_crisis_flag_stats(p_user_id UUID)
RETURNS TABLE(
  total_flags INTEGER,
  resolved_flags INTEGER,
  avg_resolution_hours NUMERIC,
  most_common_risk TEXT,
  last_flag_date TIMESTAMPTZ,
  current_status TEXT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
  WITH user_stats AS (
    SELECT 
      COUNT(*)::INTEGER as total_flags,
      COUNT(*) FILTER (WHERE status IN ('resolved', 'dismissed'))::INTEGER as resolved_flags,
      ROUND(
        AVG(
          CASE 
            WHEN resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (resolved_at - flagged_at)) / 3600 
            ELSE NULL 
          END
        )::NUMERIC, 
        2
      ) as avg_resolution_hours,
      MAX(flagged_at) as last_flag_date
    FROM public.crisis_session_flags 
    WHERE user_id = p_user_id
  ),
  risk_analysis AS (
    SELECT 
      unnest(detected_risks) as risk,
      COUNT(*) as risk_count
    FROM public.crisis_session_flags 
    WHERE user_id = p_user_id
    GROUP BY unnest(detected_risks)
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ),
  current_user_status AS (
    SELECT 
      CASE 
        WHEN is_flagged_for_review THEN 'Flagged for Review'
        ELSE 'No Active Flags'
      END as status
    FROM public.user_session_status 
    WHERE user_id = p_user_id
  )
  SELECT 
    us.total_flags,
    us.resolved_flags,
    us.avg_resolution_hours,
    ra.risk as most_common_risk,
    us.last_flag_date,
    cus.status as current_status
  FROM user_stats us
  LEFT JOIN risk_analysis ra ON true
  LEFT JOIN current_user_status cus ON true;
$$;

COMMENT ON FUNCTION public.get_crisis_flags_summary IS 'Get summary statistics for crisis flags within a date range';
COMMENT ON FUNCTION public.escalate_stale_crisis_flags IS 'Automatically escalate crisis flags that have been pending too long';
COMMENT ON FUNCTION public.get_users_requiring_attention IS 'Get users who require immediate attention based on crisis flags';
COMMENT ON FUNCTION public.cleanup_old_crisis_flags IS 'Clean up old resolved crisis flags beyond retention period';
COMMENT ON FUNCTION public.validate_crisis_flag_data IS 'Validate crisis flag data and status transitions';
COMMENT ON FUNCTION public.get_user_crisis_flag_stats IS 'Get detailed statistics for a specific user crisis flags';

-- Comments for audit and PITR functions
COMMENT ON FUNCTION public.get_record_at_timestamp IS 'Retrieve the state of a record at a specific point in time for audit/recovery purposes';
COMMENT ON FUNCTION public.get_record_change_history IS 'Get complete change history for a record within a time range';

-- Comments for history tables
COMMENT ON TABLE public.crisis_session_flags_history IS 'Audit trail and point-in-time recovery for crisis_session_flags table';
COMMENT ON TABLE public.user_session_status_history IS 'Audit trail and point-in-time recovery for user_session_status table';
COMMENT ON COLUMN public.crisis_session_flags_history.operation IS 'Database operation that caused this history entry (INSERT, UPDATE, DELETE)';
COMMENT ON COLUMN public.crisis_session_flags_history.changed_fields IS 'Array of field names that were modified in UPDATE operations';
COMMENT ON COLUMN public.crisis_session_flags_history.old_values IS 'Previous values for changed fields (UPDATE/DELETE operations)';
COMMENT ON COLUMN public.crisis_session_flags_history.new_values IS 'New values for changed fields (INSERT/UPDATE operations)';

-- Point-in-Time Recovery utility function
CREATE OR REPLACE FUNCTION public.get_record_at_timestamp(
  p_table_name TEXT,
  p_record_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
DECLARE
  result JSONB;
  history_table TEXT;
  query_text TEXT;
BEGIN
  -- Determine the history table name
  history_table := p_table_name || '_history';
  
  -- Validate table names to prevent SQL injection
  IF p_table_name NOT IN ('crisis_session_flags', 'user_session_status') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  -- Query the history table for the most recent record before the timestamp
  query_text := format(
    'SELECT new_values FROM public.%I 
     WHERE id = $1 AND operation_timestamp <= $2 AND operation != ''DELETE''
     ORDER BY operation_timestamp DESC LIMIT 1',
    history_table
  );
  
  EXECUTE query_text INTO result USING p_record_id, p_timestamp;
  
  -- If no history found, try to get the current record if it was created before the timestamp
  IF result IS NULL THEN
    query_text := format(
      'SELECT row_to_json(t)::JSONB FROM public.%I t 
       WHERE id = $1 AND created_at <= $2',
      p_table_name
    );
    
    EXECUTE query_text INTO result USING p_record_id, p_timestamp;
  END IF;
  
  RETURN result;
END;
$$;

-- Function to get all changes for a record within a time range
CREATE OR REPLACE FUNCTION public.get_record_change_history(
  p_table_name TEXT,
  p_record_id UUID,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  operation_timestamp TIMESTAMPTZ,
  operation TEXT,
  operation_user_id UUID,
  changed_fields TEXT[],
  old_values JSONB,
  new_values JSONB
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
DECLARE
  history_table TEXT;
  query_text TEXT;
BEGIN
  -- Determine the history table name
  history_table := p_table_name || '_history';
  
  -- Validate table names to prevent SQL injection
  IF p_table_name NOT IN ('crisis_session_flags', 'user_session_status') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;
  
  -- Build the query
  query_text := format(
    'SELECT 
       operation_timestamp,
       operation,
       operation_user_id,
       changed_fields,
       old_values,
       new_values
     FROM public.%I 
     WHERE id = $1',
    history_table
  );
  
  -- Add time range conditions
  IF p_start_time IS NOT NULL THEN
    query_text := query_text || ' AND operation_timestamp >= $3';
  END IF;
  
  query_text := query_text || ' AND operation_timestamp <= $2 ORDER BY operation_timestamp DESC';
  
  -- Execute the query
  IF p_start_time IS NOT NULL THEN
    RETURN QUERY EXECUTE query_text USING p_record_id, p_end_time, p_start_time;
  ELSE
    RETURN QUERY EXECUTE query_text USING p_record_id, p_end_time;
  END IF;
END;
$$;

-- Comments for audit and PITR functions
COMMENT ON FUNCTION public.get_record_at_timestamp IS 'Retrieve the state of a record at a specific point in time for audit/recovery purposes';
COMMENT ON FUNCTION public.get_record_change_history IS 'Get complete change history for a record within a time range';

-- Comments for history tables
COMMENT ON TABLE public.crisis_session_flags_history IS 'Audit trail and point-in-time recovery for crisis_session_flags table';
COMMENT ON TABLE public.user_session_status_history IS 'Audit trail and point-in-time recovery for user_session_status table';
COMMENT ON COLUMN public.crisis_session_flags_history.operation IS 'Database operation that caused this history entry (INSERT, UPDATE, DELETE)';
COMMENT ON COLUMN public.crisis_session_flags_history.changed_fields IS 'Array of field names that were modified in UPDATE operations';
COMMENT ON COLUMN public.crisis_session_flags_history.old_values IS 'Previous values for changed fields (UPDATE/DELETE operations)';
COMMENT ON COLUMN public.crisis_session_flags_history.new_values IS 'New values for changed fields (INSERT/UPDATE operations)';

-- Additional performance indexes for history tables
CREATE INDEX idx_crisis_flags_history_record_id ON public.crisis_session_flags_history(id);
CREATE INDEX idx_crisis_flags_history_user_id ON public.crisis_session_flags_history(user_id);
CREATE INDEX idx_crisis_flags_history_operation ON public.crisis_session_flags_history(operation);
CREATE INDEX idx_crisis_flags_history_operation_timestamp ON public.crisis_session_flags_history(operation_timestamp);
CREATE INDEX idx_crisis_flags_history_operation_user ON public.crisis_session_flags_history(operation_user_id) WHERE operation_user_id IS NOT NULL;
-- Composite index for point-in-time recovery queries
CREATE INDEX idx_crisis_flags_history_pitr ON public.crisis_session_flags_history(id, operation_timestamp DESC);

CREATE INDEX idx_session_status_history_record_id ON public.user_session_status_history(id);
CREATE INDEX idx_session_status_history_user_id ON public.user_session_status_history(user_id);
CREATE INDEX idx_session_status_history_operation ON public.user_session_status_history(operation);
CREATE INDEX idx_session_status_history_operation_timestamp ON public.user_session_status_history(operation_timestamp);
CREATE INDEX idx_session_status_history_operation_user ON public.user_session_status_history(operation_user_id) WHERE operation_user_id IS NOT NULL;
-- Composite index for point-in-time recovery queries
CREATE INDEX idx_session_status_history_pitr ON public.user_session_status_history(id, operation_timestamp DESC);
