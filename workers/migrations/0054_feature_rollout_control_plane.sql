CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  owner TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flag_rules (
  flag_key TEXT PRIMARY KEY,
  audience TEXT NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'admin', 'teacher', 'student', 'parent')),
  percentage INTEGER NOT NULL DEFAULT 100 CHECK (percentage BETWEEN 0 AND 100),
  allow_users_json TEXT NOT NULL DEFAULT '[]',
  allow_classes_json TEXT NOT NULL DEFAULT '[]',
  starts_at TEXT,
  ends_at TEXT,
  stop_conditions_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feature_flag_audit (
  id TEXT PRIMARY KEY,
  flag_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('UPDATED', 'ROLLED_BACK')),
  field_name TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  request_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_flag_created
  ON feature_flag_audit(flag_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_actor_created
  ON feature_flag_audit(actor_username, created_at DESC);

INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
)
SELECT
  'unified_notifications_v1',
  'Unified notification surfaces',
  CASE WHEN LOWER(COALESCE((SELECT setting_value FROM system_settings WHERE setting_key='unified_notifications_v1'), 'false')) IN ('true', '1') THEN 1 ELSE 0 END,
  'platform',
  1,
  datetime('now'),
  datetime('now');

INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
)
SELECT
  'ai_assistant_enabled',
  'Teacher AI assistant',
  CASE WHEN LOWER(COALESCE((SELECT setting_value FROM system_settings WHERE setting_key='ai_assistant_enabled'), 'false')) IN ('true', '1') THEN 1 ELSE 0 END,
  'platform',
  1,
  datetime('now'),
  datetime('now');

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES
  ('unified_notifications_v1', 'all', 100, '[]', '[]', NULL, NULL,
   '{"max5xxRatePercent":1,"maxClientErrorMultiplier":2,"maxP95IncreasePercent":30}',
   'Migrated from system settings', 'migration-0054', datetime('now')),
  ('ai_assistant_enabled', 'teacher', 100, '[]', '[]', NULL, NULL,
   '{"max5xxRatePercent":1,"maxClientErrorMultiplier":2,"maxP95IncreasePercent":30}',
   'Migrated from system settings', 'migration-0054', datetime('now'));
