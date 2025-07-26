-- supabase/migrations/YYYYMMDDHHMMSS_create_treatment_plan_tables.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define ENUM types for status fields for consistency and validation
CREATE TYPE treatment_plan_status AS ENUM (
  'Draft',
  'Active',
  'Completed',
  'Discontinued',
  'Archived'
);

CREATE TYPE treatment_goal_status AS ENUM (
  'Not Started',
  'In Progress',
  'Achieved',
  'Partially Achieved',
  'Not Achieved'
);

CREATE TYPE treatment_objective_status AS ENUM (
  'Not Started',
  'In Progress',
  'Completed',
  'On Hold',
  'Cancelled'
);

-- Create treatment_plans table
CREATE TABLE public.treatment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id TEXT, -- Can be plain text or an ID from another system
  therapist_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Therapist who created/manages, linked to auth.users
  title TEXT NOT NULL,
  diagnosis TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  status treatment_plan_status NOT NULL DEFAULT 'Draft',
  general_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

-- Create treatment_goals table
CREATE TABLE public.treatment_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES public.treatment_plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- For RLS consistency
  description TEXT NOT NULL,
  target_date TIMESTAMPTZ,
  status treatment_goal_status NOT NULL DEFAULT 'Not Started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.treatment_goals ENABLE ROW LEVEL SECURITY;

-- Create treatment_objectives table
CREATE TABLE public.treatment_objectives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES public.treatment_goals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- For RLS consistency
  description TEXT NOT NULL,
  target_date TIMESTAMPTZ,
  status treatment_objective_status NOT NULL DEFAULT 'Not Started',
  interventions TEXT[], -- Array of intervention descriptions
  progress_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.treatment_objectives ENABLE ROW LEVEL SECURITY;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''; -- IMPORTANT: Use SECURITY DEFINER for triggers that modify tables owned by others, if needed.
-- For this simple updated_at, SECURITY INVOKER is fine if the user has permissions or if called by postgres role.
-- Let's assume INVOKER is fine for user-owned tables.
-- Reverting to SECURITY INVOKER as it's safer default unless DEFINER is strictly proven necessary.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';


-- Triggers for updated_at timestamps
CREATE TRIGGER set_treatment_plans_updated_at
BEFORE UPDATE ON public.treatment_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_treatment_goals_updated_at
BEFORE UPDATE ON public.treatment_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_treatment_objectives_updated_at
BEFORE UPDATE ON public.treatment_objectives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
-- Users can manage their own treatment plans
CREATE POLICY "Allow users to manage their own treatment_plans" 
  ON public.treatment_plans
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can manage goals belonging to their plans
CREATE POLICY "Allow users to manage goals for their own plans" 
  ON public.treatment_goals
  FOR ALL
  USING (auth.uid() = user_id AND plan_id IN (SELECT id FROM public.treatment_plans WHERE user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND plan_id IN (SELECT id FROM public.treatment_plans WHERE user_id = auth.uid()));

-- Users can manage objectives belonging to their goals
CREATE POLICY "Allow users to manage objectives for their own goals" 
  ON public.treatment_objectives
  FOR ALL
  USING (auth.uid() = user_id AND goal_id IN (SELECT id FROM public.treatment_goals WHERE user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND goal_id IN (SELECT id FROM public.treatment_goals WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_treatment_plans_user_id ON public.treatment_plans(user_id);
CREATE INDEX idx_treatment_goals_plan_id ON public.treatment_goals(plan_id);
CREATE INDEX idx_treatment_goals_user_id ON public.treatment_goals(user_id);
CREATE INDEX idx_treatment_objectives_goal_id ON public.treatment_objectives(goal_id);
CREATE INDEX idx_treatment_objectives_user_id ON public.treatment_objectives(user_id);

-- Comments for clarity
COMMENT ON TABLE public.treatment_plans IS 'Stores high-level treatment plans for users.';
COMMENT ON COLUMN public.treatment_plans.user_id IS 'Owner of the treatment plan, links to auth.users.';
COMMENT ON COLUMN public.treatment_plans.therapist_id IS 'Therapist managing the plan, links to auth.users.';
COMMENT ON TABLE public.treatment_goals IS 'Stores specific goals within a treatment plan.';
COMMENT ON TABLE public.treatment_objectives IS 'Stores measurable objectives for each goal.'; 

