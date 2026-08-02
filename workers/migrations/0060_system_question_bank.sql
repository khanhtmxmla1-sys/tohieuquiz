-- System-wide shared question bank with backward-compatible personal-bank backfill.

CREATE TABLE IF NOT EXISTS question_bank_items (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('SYSTEM', 'PERSONAL')),
  owner_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),

  question_data TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 3),
  explanation TEXT NOT NULL DEFAULT '',

  grade INTEGER,
  subject TEXT NOT NULL DEFAULT '',
  semester INTEGER,
  topic_code TEXT NOT NULL DEFAULT '',
  lesson_code TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  tags TEXT NOT NULL DEFAULT '[]',

  content_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  archived_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_unique_content
  ON question_bank_items(scope, owner_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_question_bank_browse
  ON question_bank_items(scope, status, grade, subject, semester, topic_code, lesson_code);
CREATE INDEX IF NOT EXISTS idx_question_bank_owner
  ON question_bank_items(owner_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_bank_type_difficulty
  ON question_bank_items(question_type, difficulty);

CREATE TABLE IF NOT EXISTS question_bank_audit (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('CREATE', 'UPDATE', 'PUBLISH', 'ARCHIVE', 'RESTORE', 'BULK_IMPORT')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_question_bank_audit_item_created
  ON question_bank_audit(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_bank_audit_actor_created
  ON question_bank_audit(actor_id, created_at DESC);

-- Preserve every legacy personal item. Invalid JSON is retained as raw question_data
-- and receives empty searchable metadata so one malformed row cannot abort migration.
INSERT OR IGNORE INTO question_bank_items (
  id, scope, owner_id, status, question_data, question_text, question_type,
  difficulty, explanation, grade, subject, semester, topic_code, lesson_code,
  source, tags, content_hash, created_by, updated_by, created_at, updated_at,
  published_at
)
SELECT
  id,
  'PERSONAL',
  teacher_id,
  'PUBLISHED',
  question_data,
  CASE WHEN json_valid(question_data)
    THEN COALESCE(json_extract(question_data, '$.question'), json_extract(question_data, '$.mainQuestion'), '')
    ELSE ''
  END,
  CASE WHEN json_valid(question_data)
    THEN COALESCE(json_extract(question_data, '$.type'), '')
    ELSE ''
  END,
  CASE WHEN json_valid(question_data)
    THEN json_extract(question_data, '$.difficulty')
    ELSE NULL
  END,
  CASE WHEN json_valid(question_data)
    THEN COALESCE(json_extract(question_data, '$.explanation'), '')
    ELSE ''
  END,
  NULL,
  CASE WHEN json_valid(question_data)
    THEN COALESCE(json_extract(question_data, '$.subject'), '')
    ELSE ''
  END,
  NULL,
  '',
  '',
  'LEGACY',
  COALESCE(tags, '[]'),
  'legacy:' || id,
  teacher_id,
  teacher_id,
  COALESCE(created_at, datetime('now')),
  COALESCE(created_at, datetime('now')),
  COALESCE(created_at, datetime('now'))
FROM test_bank;

INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES (
  'system_question_bank_v1',
  'System-wide shared question bank',
  0,
  'assessment-platform',
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES (
  'system_question_bank_v1',
  'teacher',
  100,
  '[]',
  '[]',
  NULL,
  NULL,
  '{"max5xxRatePercent":1,"maxClientErrorMultiplier":2,"maxP95IncreasePercent":30}',
  'Disabled until shared question-bank API and UI verification completes',
  'migration-0060',
  datetime('now')
);
