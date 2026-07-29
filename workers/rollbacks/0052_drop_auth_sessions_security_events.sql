DROP INDEX IF EXISTS idx_security_events_retention;
DROP INDEX IF EXISTS idx_security_events_type_created;
DROP INDEX IF EXISTS idx_security_events_user_created;
DROP TABLE IF EXISTS security_events;

DROP INDEX IF EXISTS idx_auth_sessions_retention;
DROP INDEX IF EXISTS idx_auth_sessions_active_expiry;
DROP INDEX IF EXISTS idx_auth_sessions_user_created;
DROP TABLE IF EXISTS auth_sessions;

-- retained: students.token_version remains because SQLite D1 cannot safely drop
-- the column in-place during an emergency rollback. Runtime code defaults to 1.
