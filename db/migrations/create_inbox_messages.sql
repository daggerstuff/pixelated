-- Inbox messages owned by a user (workspace surface)
-- Backs the px gmail CLI command and /api/workspace/gmail routes.
-- This is a local owner-scoped message store (the app's EmailService is
-- outbound-only via nodemailer — no inbox exists). Scoping model matches
-- documents: owner_id is the access boundary.

CREATE TABLE IF NOT EXISTS inbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255) NOT NULL,
    from_name VARCHAR(255) DEFAULT '',
    from_address VARCHAR(255) NOT NULL,
    to_addresses TEXT[] DEFAULT '{}',
    subject VARCHAR(512) NOT NULL,
    body TEXT DEFAULT '',
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    owner_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (owner_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_owner ON inbox_messages(owner_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_owner_received ON inbox_messages(owner_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_owner_unread ON inbox_messages(owner_id, read_at) WHERE read_at IS NULL;
