-- Add email_verified column to users table for better-auth compatibility
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;