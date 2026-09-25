-- Server-stored teacher BYOK credentials and per-action source binding.
-- Feature remains disabled by default until secrets, migration and rollout are separately approved.

CREATE TABLE IF NOT EXISTS teacher_ai_credentials (
  username TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'deepseek')),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  key_id TEXT NOT NULL,
  format_version INTEGER NOT NULL CHECK (format_version = 1),
  last4 TEXT NOT NULL CHECK (LENGTH(last4) = 4),
  version INTEGER NOT NULL CHECK (version > 0),
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, provider),
  FOREIGN KEY (username) REFERENCES teachers(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_teacher_ai_credentials_key_id
  ON teacher_ai_credentials(key_id);

CREATE TABLE IF NOT EXISTS teacher_ai_credential_audit (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'admin')),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'AI_KEY_SAVED', 'AI_KEY_DELETED', 'AI_KEY_TESTED'
  )),
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'deepseek')),
  operation TEXT NOT NULL CHECK (operation IN ('save', 'delete', 'test')),
  result_code TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_ai_credential_audit_owner_created
  ON teacher_ai_credential_audit(username, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_teacher_ai_credential_audit_immutable_update
BEFORE UPDATE ON teacher_ai_credential_audit
BEGIN
  SELECT RAISE(ABORT, 'TEACHER_AI_CREDENTIAL_AUDIT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_teacher_ai_credential_audit_immutable_delete
BEFORE DELETE ON teacher_ai_credential_audit
BEGIN
  SELECT RAISE(ABORT, 'TEACHER_AI_CREDENTIAL_AUDIT_IMMUTABLE');
END;

ALTER TABLE ai_generation_actions
  ADD COLUMN source TEXT NOT NULL DEFAULT 'system'
    CHECK (source IN ('system', 'gemini-personal', 'deepseek-personal'));
ALTER TABLE ai_generation_actions
  ADD COLUMN credential_version INTEGER
    CHECK (credential_version IS NULL OR credential_version > 0);
ALTER TABLE ai_generation_actions
  ADD COLUMN ai_model TEXT;
ALTER TABLE ai_generation_actions
  ADD COLUMN active_stage TEXT
    CHECK (
      active_stage IS NULL
      OR active_stage IN ('OCR', 'GENERATE', 'REVIEW', 'REPAIR', 'REGENERATE', 'GENERIC')
    );
ALTER TABLE ai_generation_actions
  ADD COLUMN active_stage_started_at TEXT;

INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES (
  'teacher_ai_byok_v1',
  'Teacher-owned Gemini and DeepSeek API keys stored encrypted on the server',
  0,
  'ai-platform',
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES (
  'teacher_ai_byok_v1', 'teacher', 0, '[]', '[]', NULL, NULL,
  '{"max5xxRatePercent":1}',
  'BYOK stays disabled until encrypted storage and server dispatch are verified',
  'migration-0083',
  datetime('now')
);
