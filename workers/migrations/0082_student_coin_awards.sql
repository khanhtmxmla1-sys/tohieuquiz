-- Canonical persistence and governance for audited manual student coin awards.
-- The award ledger remains the source of balance truth; this migration stores
-- immutable batch metadata, configurable teacher limits, and rollout state.

CREATE TABLE IF NOT EXISTS coin_award_batches (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('AWARD', 'REVERSAL', 'ADJUSTMENT')),
  parent_batch_id TEXT,
  actor_username TEXT NOT NULL,
  actor_display_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('teacher', 'admin')),
  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('STUDENT', 'SELECTED', 'CLASS')),
  class_id TEXT,
  class_name TEXT,
  coins_per_student INTEGER NOT NULL
    CHECK (coins_per_student <> 0 AND ABS(coins_per_student) <= 1000000),
  recipient_count INTEGER NOT NULL CHECK (recipient_count BETWEEN 1 AND 100),
  total_coins INTEGER NOT NULL
    CHECK (total_coins = coins_per_student * recipient_count),
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) BETWEEN 3 AND 200),
  idempotency_key TEXT NOT NULL CHECK (LENGTH(TRIM(idempotency_key)) BETWEEN 1 AND 200),
  request_hash TEXT NOT NULL CHECK (LENGTH(TRIM(request_hash)) BETWEEN 1 AND 200),
  hanoi_date TEXT NOT NULL,
  reversal_expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (parent_batch_id) REFERENCES coin_award_batches(id),
  UNIQUE (actor_username, idempotency_key)
);

CREATE TABLE IF NOT EXISTS coin_award_settings (
  scope_key TEXT PRIMARY KEY CHECK (scope_key = 'school'),
  max_coins_per_student INTEGER NOT NULL
    CHECK (max_coins_per_student BETWEEN 1 AND 1000000),
  max_teacher_daily_coins INTEGER NOT NULL
    CHECK (max_teacher_daily_coins BETWEEN 1 AND 100000000),
  reversal_window_minutes INTEGER NOT NULL
    CHECK (reversal_window_minutes BETWEEN 1 AND 1440),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_award_setting_audit (
  id TEXT PRIMARY KEY,
  scope_key TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) BETWEEN 3 AND 200),
  created_at TEXT NOT NULL,
  FOREIGN KEY (scope_key) REFERENCES coin_award_settings(scope_key)
);

CREATE INDEX IF NOT EXISTS idx_coin_award_batches_actor_date_created
  ON coin_award_batches(actor_username, hanoi_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_award_batches_class_created
  ON coin_award_batches(class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_award_batches_parent
  ON coin_award_batches(parent_batch_id);
CREATE INDEX IF NOT EXISTS idx_coin_award_setting_audit_scope_created
  ON coin_award_setting_audit(scope_key, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_coin_award_batches_immutable_update
BEFORE UPDATE ON coin_award_batches
BEGIN
  SELECT RAISE(ABORT, 'COIN_AWARD_BATCH_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_coin_award_batches_immutable_delete
BEFORE DELETE ON coin_award_batches
BEGIN
  SELECT RAISE(ABORT, 'COIN_AWARD_BATCH_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_coin_award_setting_audit_immutable_update
BEFORE UPDATE ON coin_award_setting_audit
BEGIN
  SELECT RAISE(ABORT, 'COIN_AWARD_SETTING_AUDIT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_coin_award_setting_audit_immutable_delete
BEFORE DELETE ON coin_award_setting_audit
BEGIN
  SELECT RAISE(ABORT, 'COIN_AWARD_SETTING_AUDIT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_coin_award_settings_required
BEFORE DELETE ON coin_award_settings
BEGIN
  SELECT RAISE(ABORT, 'COIN_AWARD_SETTINGS_REQUIRED');
END;

CREATE TRIGGER IF NOT EXISTS trg_coin_award_teacher_limits
BEFORE INSERT ON coin_award_batches
WHEN NEW.actor_role = 'teacher'
  AND NEW.kind = 'AWARD'
  AND NEW.coins_per_student > 0
BEGIN
  SELECT CASE
    WHEN NEW.coins_per_student > (
      SELECT max_coins_per_student FROM coin_award_settings WHERE scope_key = 'school'
    ) THEN RAISE(ABORT, 'COIN_AWARD_PER_STUDENT_LIMIT')
    WHEN NEW.total_coins > (
      (
        SELECT max_teacher_daily_coins FROM coin_award_settings WHERE scope_key = 'school'
      ) - COALESCE((
        SELECT SUM(total_coins)
        FROM coin_award_batches
        WHERE actor_username = NEW.actor_username
          AND hanoi_date = NEW.hanoi_date
          AND actor_role = 'teacher'
          AND kind = 'AWARD'
          AND coins_per_student > 0
      ), 0)
    ) THEN RAISE(ABORT, 'COIN_AWARD_DAILY_LIMIT')
  END;
END;

INSERT OR IGNORE INTO coin_award_settings (
  scope_key, max_coins_per_student, max_teacher_daily_coins,
  reversal_window_minutes, updated_by, updated_at
) VALUES (
  'school', 100, 2000, 15, 'migration-0082', datetime('now')
);

INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES (
  'student_coin_awards_v1',
  'Audited teacher and administrator manual student coin awards',
  0,
  'gamification',
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES (
  'student_coin_awards_v1', 'teacher', 100, '[]', '[]', NULL, NULL, '{}',
  'Manual coin awards start disabled until backend and frontend verification pass',
  'migration-0082', datetime('now')
);
