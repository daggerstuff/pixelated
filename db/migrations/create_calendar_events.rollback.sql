-- Rollback: drop calendar_events table and its trigger function

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON calendar_events;
DROP TABLE IF EXISTS calendar_events;
DROP FUNCTION IF EXISTS update_calendar_events_updated_at_column();
