-- PIX-3757: Create the audit_logs table for the request-level audit middleware
-- (src/api/middleware/logger.ts). The middleware INSERTs into audit_logs on
-- authenticated mutations/exports/approvals; without this table that INSERT
-- failed silently (volatile). Creating the table makes the audit sink real.
--
-- Column set matches the middleware's INSERT exactly:
--   (user_id, action, resource_type, resource_id, changes, ip_address, user_agent, status, created_at)

CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       VARCHAR(255),
    action        VARCHAR(50)  NOT NULL,
    resource_type VARCHAR(50),
    resource_id   VARCHAR(255),
    changes       TEXT,
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'success',
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at);
