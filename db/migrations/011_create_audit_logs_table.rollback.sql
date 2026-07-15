-- Rollback for 011_create_audit_logs_table.sql (PIX-3757)

DROP TABLE IF EXISTS audit_logs;
