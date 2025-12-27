-- Add missing columns required by better-auth
ALTER TABLE users
ADD COLUMN IF NOT EXISTS image VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;