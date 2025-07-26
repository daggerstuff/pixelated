-- Bias Detection Engine Database Schema
-- Production-grade tables for storing bias analysis data

-- Main bias analysis results table
create table if not exists bias_analyses (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  timestamp timestamptz not null default now(),
  overall_bias_score numeric(5,4) not null check (overall_bias_score >= 0 and overall_bias_score <= 1),
  alert_level text not null check (alert_level in ('low', 'medium', 'high', 'critical')),
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  
  -- Layer results stored as JSONB for flexibility
  preprocessing_result jsonb,
  model_level_result jsonb,
  interactive_result jsonb,
  evaluation_result jsonb,
  
  -- Demographics
  participant_demographics jsonb not null,
  
  -- Analysis metadata
  recommendations text[],
  processing_time_ms integer,
  python_service_available boolean default true,
  
  -- Audit fields
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id),
  
  -- Constraints
  unique(session_id, timestamp)
);

-- Bias alerts table for real-time monitoring
create table if not exists bias_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_id text not null unique,
  session_id text not null,
  analysis_id uuid references bias_analyses(id) on delete cascade,
  
  level text not null check (level in ('low', 'medium', 'high', 'critical')),
  type text not null, -- 'gender', 'cultural', 'age', etc.
  message text not null,
  
  timestamp timestamptz not null default now(),
  acknowledged boolean not null default false,
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  
  resolved boolean not null default false,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_notes text,
  
  -- Metadata
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Dashboard metrics aggregation table for performance
create table if not exists bias_metrics_daily (
  date date not null,
  total_sessions integer not null default 0,
  average_bias_score numeric(5,4),
  alert_counts jsonb not null default '{}', -- {"low": 5, "medium": 3, "high": 1, "critical": 0}
  demographic_breakdown jsonb not null default '{}',
  processing_time_stats jsonb not null default '{}', -- {"avg": 150, "min": 50, "max": 500}
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  primary key (date)
);

-- System performance metrics
create table if not exists bias_system_metrics (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  
  -- Performance metrics
  response_time_ms integer,
  memory_usage_mb integer,
  cpu_usage_percent numeric(5,2),
  active_connections integer,
  cache_hit_rate numeric(5,4),
  
  -- Service health
  python_service_status text check (python_service_status in ('up', 'down', 'degraded')),
  database_status text check (database_status in ('up', 'down', 'degraded')),
  overall_health text check (overall_health in ('healthy', 'degraded', 'critical')),
  
  -- Error tracking
  error_count integer default 0,
  error_rate numeric(5,4),
  
  created_at timestamptz not null default now()
);

-- Audit log for compliance
create table if not exists bias_audit_logs (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  session_id text,
  user_id uuid references auth.users(id),
  
  action text not null,
  resource text,
  details jsonb,
  
  -- Request context
  ip_address inet,
  user_agent text,
  
  -- Compliance fields
  data_accessed text[],
  retention_period_days integer,
  
  created_at timestamptz not null default now()
);

-- Create indexes for performance
create index bias_analyses_session_id_idx on bias_analyses(session_id);
create index bias_analyses_timestamp_idx on bias_analyses(timestamp desc);
create index bias_analyses_alert_level_idx on bias_analyses(alert_level);
create index bias_analyses_overall_bias_score_idx on bias_analyses(overall_bias_score);
create index bias_analyses_demographics_gin_idx on bias_analyses using gin(participant_demographics);

create index bias_alerts_session_id_idx on bias_alerts(session_id);
create index bias_alerts_level_idx on bias_alerts(level);
create index bias_alerts_timestamp_idx on bias_alerts(timestamp desc);
create index bias_alerts_acknowledged_idx on bias_alerts(acknowledged) where not acknowledged;

create index bias_metrics_daily_date_idx on bias_metrics_daily(date desc);

create index bias_system_metrics_timestamp_idx on bias_system_metrics(timestamp desc);

create index bias_audit_logs_timestamp_idx on bias_audit_logs(timestamp desc);
create index bias_audit_logs_user_id_idx on bias_audit_logs(user_id);
create index bias_audit_logs_session_id_idx on bias_audit_logs(session_id);

-- Enable Row Level Security
alter table bias_analyses enable row level security;
alter table bias_alerts enable row level security;
alter table bias_metrics_daily enable row level security;
alter table bias_system_metrics enable row level security;
alter table bias_audit_logs enable row level security;

-- RLS Policies

-- Bias analyses: Users can view their own data, admins can view all
create policy "Users can view their own bias analyses" on bias_analyses
  for select using (
    auth.uid() = user_id or 
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.role in ('admin', 'supervisor')
    )
  );

create policy "System can insert bias analyses" on bias_analyses
  for insert with check (true);

create policy "Admins can update bias analyses" on bias_analyses
  for update using (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.role = 'admin'
    )
  );

-- Bias alerts: Similar to analyses
create policy "Users can view relevant bias alerts" on bias_alerts
  for select using (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.role in ('admin', 'supervisor')
    )
  );

create policy "System can insert bias alerts" on bias_alerts
  for insert with check (true);

create policy "Authorized users can acknowledge alerts" on bias_alerts
  for update using (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.role in ('admin', 'supervisor')
    )
  );

-- Dashboard metrics: Read-only for authorized users
create policy "Authorized users can view dashboard metrics" on bias_metrics_daily
  for select using (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.role in ('admin', 'supervisor', 'analyst')
    )
  );

create policy "System can manage dashboard metrics" on bias_metrics_daily
  for all using (auth.role() = 'service_role');

-- System metrics: Admin only
create policy "Admins can view system metrics" on bias_system_metrics
  for select using (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.role = 'admin'
    )
  );

create policy "System can insert system metrics" on bias_system_metrics
  for insert with check (true);

-- Audit logs: Admin only, no updates/deletes
create policy "Admins can view audit logs" on bias_audit_logs
  for select using (
    exists (
      select 1 from profiles 
      where profiles.id = auth.uid() 
      and profiles.role = 'admin'
    )
  );

create policy "System can insert audit logs" on bias_audit_logs
  for insert with check (true);

-- Functions for aggregation and maintenance

-- Function to update daily metrics
create or replace function update_daily_bias_metrics()
returns void
language plpgsql
security definer
as $$
begin
  insert into bias_metrics_daily (
    date,
    total_sessions,
    average_bias_score,
    alert_counts,
    demographic_breakdown,
    processing_time_stats
  )
  select 
    current_date,
    count(*) as total_sessions,
    avg(overall_bias_score) as average_bias_score,
    jsonb_build_object(
      'low', count(*) filter (where alert_level = 'low'),
      'medium', count(*) filter (where alert_level = 'medium'),
      'high', count(*) filter (where alert_level = 'high'),
      'critical', count(*) filter (where alert_level = 'critical')
    ) as alert_counts,
    jsonb_build_object(
      'age', jsonb_agg(distinct participant_demographics->>'age'),
      'gender', jsonb_agg(distinct participant_demographics->>'gender'),
      'ethnicity', jsonb_agg(distinct participant_demographics->>'ethnicity')
    ) as demographic_breakdown,
    jsonb_build_object(
      'avg', avg(processing_time_ms),
      'min', min(processing_time_ms),
      'max', max(processing_time_ms)
    ) as processing_time_stats
  from bias_analyses
  where date(timestamp) = current_date
  on conflict (date) do update set
    total_sessions = excluded.total_sessions,
    average_bias_score = excluded.average_bias_score,
    alert_counts = excluded.alert_counts,
    demographic_breakdown = excluded.demographic_breakdown,
    processing_time_stats = excluded.processing_time_stats,
    updated_at = now();
end;
$$;

-- Function to clean up old data (HIPAA compliance)
create or replace function cleanup_old_bias_data()
returns void
language plpgsql
security definer
as $$
begin
  -- Delete analyses older than 7 years (HIPAA requirement)
  delete from bias_analyses 
  where timestamp < now() - interval '7 years';
  
  -- Delete system metrics older than 1 year
  delete from bias_system_metrics 
  where timestamp < now() - interval '1 year';
  
  -- Delete daily metrics older than 3 years
  delete from bias_metrics_daily 
  where date < current_date - interval '3 years';
  
  -- Archive audit logs older than 7 years
  -- (In production, you'd move these to cold storage instead of deleting)
  delete from bias_audit_logs 
  where timestamp < now() - interval '7 years';
end;
$$;

-- Triggers for automatic updates
create or replace function update_bias_analyses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bias_analyses_updated_at_trigger
  before update on bias_analyses
  for each row
  execute function update_bias_analyses_updated_at();

-- Schedule daily metrics update (requires pg_cron extension)
-- select cron.schedule('update-daily-bias-metrics', '0 1 * * *', 'select update_daily_bias_metrics();');

-- Schedule weekly cleanup (requires pg_cron extension)  
-- select cron.schedule('cleanup-old-bias-data', '0 2 * * 0', 'select cleanup_old_bias_data();');

-- Grant necessary permissions
grant usage on schema public to authenticated;
grant select, insert on bias_analyses to authenticated;
grant select, insert, update on bias_alerts to authenticated;
grant select on bias_metrics_daily to authenticated;
grant select on bias_system_metrics to authenticated;
grant select on bias_audit_logs to authenticated;

-- Service role permissions for system operations
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;