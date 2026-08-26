-- Pixelated Empathy — Database Initialization
-- Applied on first PostgreSQL container start

-- Create the pe schema
CREATE SCHEMA IF NOT EXISTS pe;

-- Note: The full schema is applied by Alembic migrations.
-- This file exists to ensure the schema/extension exist
-- before Alembic runs its first migration.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";