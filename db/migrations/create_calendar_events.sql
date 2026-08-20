-- Calendar events owned by a user (workspace surface)
-- Backs the px calendar CLI command and /api/workspace/calendar routes.
-- Scoping model matches documents: owner_id is the access boundary;
-- shared events are granted via attendees (mirrors documents.collaborators).

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    owner_id VARCHAR(255) NOT NULL,
    attendees TEXT[] DEFAULT '{}',
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(255) DEFAULT '',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT calendar_events_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_owner ON calendar_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_start ON calendar_events(owner_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_public ON calendar_events(is_public);

CREATE OR REPLACE FUNCTION update_calendar_events_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_calendar_events_updated_at_column();
