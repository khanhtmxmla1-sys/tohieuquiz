ALTER TABLE students ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  token_version INTEGER NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'session' CHECK (purpose IN ('session', 'password_change')),
  user_agent_family TEXT NOT NULL DEFAULT 'Other',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT,
  revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_created
  ON auth_sessions(username, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_expiry
  ON auth_sessions(username, role, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_retention
  ON auth_sessions(created_at);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'LOGIN_FAILURE_THRESHOLD',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'SESSION_REVOKED',
    'SESSIONS_REVOKED_ALL',
    'PASSKEY_ADDED',
    'PASSKEY_REMOVED'
  )),
  severity TEXT NOT NULL DEFAULT 'informational'
    CHECK (severity IN ('informational', 'action_required', 'critical')),
  actor_username TEXT,
  session_id TEXT,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_created
  ON security_events(username, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_created
  ON security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_retention
  ON security_events(created_at);
