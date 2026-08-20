-- Rollback: drop contacts table and its trigger function

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
DROP TABLE IF EXISTS contacts;
DROP FUNCTION IF EXISTS update_contacts_updated_at_column();
