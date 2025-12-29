-- Add name column to users table for better-auth compatibility
ALTER TABLE users
ADD COLUMN IF NOT EXISTS name VARCHAR(255);