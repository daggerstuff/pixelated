-- PIX-215 rollback: drop the RBAC tables.
-- Order matters: user_roles (dependant) before roles (referenced).

DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
