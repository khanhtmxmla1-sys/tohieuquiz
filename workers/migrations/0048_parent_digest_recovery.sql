-- Task 24: Parent contact preferences, privacy-minimized weekly digests and single-use recovery tokens.
CREATE TABLE IF NOT EXISTS parent_contact_preferences (
  link_id TEXT PRIMARY KEY,
  email TEXT,
  email_normalized TEXT,
  email_verified_at TEXT,
  weekly_digest_enabled INTEGER NOT NULL DEFAULT 0 CHECK (weekly_digest_enabled IN (0, 1)),
  digest_weekday INTEGER NOT NULL DEFAULT 1 CHECK (digest_weekday BETWEEN 1 AND 7),
  digest_hour INTEGER NOT NULL DEFAULT 19 CHECK (digest_hour BETWEEN 0 AND 23),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK (timezone = 'Asia/Ho_Chi_Minh'),
  quiet_hours_enabled INTEGER NOT NULL DEFAULT 1 CHECK (quiet_hours_enabled IN (0, 1)),
  quiet_hours_start_minute INTEGER NOT NULL DEFAULT 1260 CHECK (quiet_hours_start_minute BETWEEN 0 AND 1439),
  quiet_hours_end_minute INTEGER NOT NULL DEFAULT 420 CHECK (quiet_hours_end_minute BETWEEN 0 AND 1439),
  email_kinds_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES parent_links(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parent_contact_tokens (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('EMAIL_VERIFICATION', 'ACCOUNT_RECOVERY')),
  token_hash TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES parent_links(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parent_digest_runs (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  provider_message_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (link_id, week_start),
  FOREIGN KEY (link_id) REFERENCES parent_links(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parent_account_audit (
  id TEXT PRIMARY KEY,
  link_id TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'PREFERENCES_UPDATED', 'EMAIL_VERIFICATION_REQUESTED', 'EMAIL_VERIFIED',
    'RECOVERY_REQUESTED', 'PIN_RESET', 'DIGEST_SENT', 'DIGEST_FAILED'
  )),
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES parent_links(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_parent_contact_preferences_digest_due
  ON parent_contact_preferences(weekly_digest_enabled, email_verified_at, digest_weekday, digest_hour);
CREATE INDEX IF NOT EXISTS idx_parent_contact_tokens_lookup
  ON parent_contact_tokens(token_hash, purpose, expires_at, consumed_at);
CREATE INDEX IF NOT EXISTS idx_parent_contact_tokens_link_created
  ON parent_contact_tokens(link_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_digest_runs_status_updated
  ON parent_digest_runs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_account_audit_link_created
  ON parent_account_audit(link_id, created_at DESC);
