CREATE TABLE IF NOT EXISTS webauthn_credentials (
  credential_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'admin')),
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports_json TEXT NOT NULL DEFAULT '[]',
  device_type TEXT NOT NULL,
  backed_up INTEGER NOT NULL DEFAULT 0 CHECK (backed_up IN (0, 1)),
  label TEXT NOT NULL DEFAULT 'Passkey',
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_created
  ON webauthn_credentials(username, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_active
  ON webauthn_credentials(username, role, revoked_at);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'admin')),
  purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  challenge_hash TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_owner_expiry
  ON webauthn_challenges(username, role, purpose, expires_at);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_retention
  ON webauthn_challenges(created_at);
