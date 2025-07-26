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
