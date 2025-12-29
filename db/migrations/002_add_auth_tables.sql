-- Add authentication-related columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS authentication_status VARCHAR(50) DEFAULT 'unauthenticated';

-- Create auth_sessions table for Better-Auth (matching UUID type)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create auth_accounts table for Better-Auth (matching UUID type)
CREATE TABLE IF NOT EXISTS auth_accounts (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_provider ON auth_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_users_auth_status ON users(authentication_status);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_auth_sessions_updated_at ON auth_sessions;
CREATE TRIGGER update_auth_sessions_updated_at BEFORE UPDATE
    ON auth_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_auth_accounts_updated_at ON auth_accounts;
CREATE TRIGGER update_auth_accounts_updated_at BEFORE UPDATE
    ON auth_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update existing users with default authentication status
UPDATE users
SET authentication_status = 'unauthenticated'
WHERE authentication_status IS NULL;

-- Add a comment to explain the purpose of these columns
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of the last successful login';
COMMENT ON COLUMN users.login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.account_locked_until IS 'Timestamp until which the account is locked';
COMMENT ON COLUMN users.authentication_status IS 'Current authentication status of the user';