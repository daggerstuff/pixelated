-- Basic seed file for database initialization
-- Add your seed data below

-- Example: Insert initial user roles
-- INSERT INTO public.roles (name, description)
-- VALUES
--   ('admin', 'Administrator with full access'),
--   ('user', 'Regular user with limited access');

-- Add your actual seed data here

-- Insert sample todos
INSERT INTO public.todos (name, description, completed) VALUES
  ('Learn Astro Framework', 'Study the Astro framework for building modern web applications', false),
  ('Set up Supabase Database', 'Configure and populate the new Supabase database', true),
  ('Implement AI Chat Features', 'Add AI-powered chat functionality for therapy sessions', false),
  ('Create User Authentication', 'Set up secure user login and registration system', false),
  ('Design UI Components', 'Build reusable UI components with proper styling', false),
  ('Write Unit Tests', 'Add comprehensive test coverage for all features', false),
  ('Deploy to Production', 'Deploy the application to production environment', false);
