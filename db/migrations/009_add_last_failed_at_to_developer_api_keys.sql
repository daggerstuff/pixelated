-- Migration: Add last_failed_at column to developer_api_keys table
-- This column was missing from migration 008 but is used by developer-api-keys.ts

ALTER TABLE developer_api_keys ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMP;