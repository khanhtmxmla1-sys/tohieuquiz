-- Competition V1 core domain: campaign, frozen audience, six rounds, attempts,
-- materialized progress, and immutable/versioned eligibility snapshots.

CREATE TABLE IF NOT EXISTS competition_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  school_year TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'SCHEDULED', 'ACTIVE', 'ELIGIBILITY_LOCKED', 'EXAM_PREP',
      'EXAM_RUNNING', 'WITHHELD', 'RECONCILING', 'READY_TO_PUBLISH',
      'PUBLISHED', 'ARCHIVED'
    )),
  audience_rule_json TEXT NOT NULL DEFAULT '{}',
  audience_snapshot_id TEXT,
  eligibility_policy_json TEXT NOT NULL DEFAULT '{"requiredRounds":6,"requiredPassedRounds":6}',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS competition_audience_snapshots (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'BUILDING'
    CHECK (status IN ('BUILDING', 'LOCKED')),
  member_count INTEGER NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  snapshot_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  locked_at TEXT,
  created_by TEXT NOT NULL,
  UNIQUE (campaign_id, version),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  CHECK (status <> 'LOCKED' OR (locked_at IS NOT NULL AND length(snapshot_hash) > 0))
);

CREATE TABLE IF NOT EXISTS competition_audience_members (
  audience_snapshot_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  grade_level_at_snapshot INTEGER NOT NULL CHECK (grade_level_at_snapshot BETWEEN 1 AND 12),
  class_id_at_snapshot TEXT NOT NULL,
  student_status_at_snapshot TEXT NOT NULL,
  PRIMARY KEY (audience_snapshot_id, student_id),
  FOREIGN KEY (audience_snapshot_id) REFERENCES competition_audience_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS competition_quiz_snapshots (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  canonical_payload_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE (quiz_id, sha256),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
  CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*')
);

CREATE TABLE IF NOT EXISTS competition_rounds (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 6),
  opens_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
  passing_rule_type TEXT NOT NULL DEFAULT 'MIN_SCORE'
    CHECK (passing_rule_type IN ('MIN_SCORE')),
  passing_score REAL NOT NULL CHECK (passing_score BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'FINALIZED')),
  created_at TEXT NOT NULL,
  finalized_at TEXT,
  UNIQUE (campaign_id, round_number),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  CHECK (closes_at > opens_at),
  CHECK (status <> 'FINALIZED' OR finalized_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS competition_round_quizzes (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  class_id TEXT,
  quiz_id TEXT NOT NULL,
  quiz_snapshot_id TEXT NOT NULL,
  quiz_snapshot_hash TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  FOREIGN KEY (round_id) REFERENCES competition_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
  FOREIGN KEY (quiz_snapshot_id) REFERENCES competition_quiz_snapshots(id) ON DELETE RESTRICT,
  CHECK (length(quiz_snapshot_hash) = 64 AND quiz_snapshot_hash NOT GLOB '*[^0-9a-f]*')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_round_quizzes_grade_default
  ON competition_round_quizzes(round_id, grade_level)
  WHERE class_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_round_quizzes_class_override
  ON competition_round_quizzes(round_id, grade_level, class_id)
  WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS competition_round_attempts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  quiz_id TEXT NOT NULL,
  quiz_snapshot_id TEXT NOT NULL,
  quiz_snapshot_hash TEXT NOT NULL,
  result_id INTEGER,
  status TEXT NOT NULL DEFAULT 'STARTED'
    CHECK (status IN ('STARTED', 'SUBMITTED', 'SCORED', 'EXPIRED', 'VOID')),
  score REAL CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  correct_count INTEGER CHECK (correct_count IS NULL OR correct_count >= 0),
  time_taken INTEGER CHECK (time_taken IS NULL OR time_taken >= 0),
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  scored_at TEXT,
  voided_at TEXT,
  voided_by TEXT,
  void_reason TEXT,
  idempotency_key TEXT NOT NULL,
  UNIQUE (round_id, student_id, attempt_no),
  UNIQUE (student_id, idempotency_key),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES competition_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
  FOREIGN KEY (quiz_snapshot_id) REFERENCES competition_quiz_snapshots(id) ON DELETE RESTRICT,
  FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE SET NULL,
  CHECK (length(quiz_snapshot_hash) = 64 AND quiz_snapshot_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (status <> 'SCORED' OR (score IS NOT NULL AND scored_at IS NOT NULL)),
  CHECK (status <> 'VOID' OR (voided_at IS NOT NULL AND length(trim(COALESCE(void_reason, ''))) > 0))
);

CREATE TABLE IF NOT EXISTS competition_round_progress (
  campaign_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attempts_used INTEGER NOT NULL DEFAULT 0 CHECK (attempts_used >= 0),
  best_attempt_id TEXT,
  best_score REAL CHECK (best_score IS NULL OR best_score BETWEEN 0 AND 100),
  is_passed INTEGER NOT NULL DEFAULT 0 CHECK (is_passed IN (0, 1)),
  passed_at TEXT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, round_id, student_id),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES competition_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (best_attempt_id) REFERENCES competition_round_attempts(id) ON DELETE SET NULL,
  CHECK (is_passed = 0 OR best_attempt_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS competition_eligibility (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  eligibility_snapshot_version INTEGER NOT NULL CHECK (eligibility_snapshot_version > 0),
  student_id TEXT NOT NULL,
  qualified INTEGER NOT NULL CHECK (qualified IN (0, 1)),
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  qualified_at TEXT,
  computed_at TEXT NOT NULL,
  progress_digest TEXT NOT NULL,
  override_reason TEXT,
  overridden_by TEXT,
  overridden_at TEXT,
  UNIQUE (campaign_id, eligibility_snapshot_version, student_id),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  CHECK (qualified = 0 OR qualified_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_competition_campaigns_status_window
  ON competition_campaigns(status, starts_at, ends_at, id);

CREATE INDEX IF NOT EXISTS idx_competition_audience_snapshots_campaign_status
  ON competition_audience_snapshots(campaign_id, status, version DESC);

CREATE INDEX IF NOT EXISTS idx_competition_audience_members_student
  ON competition_audience_members(student_id, audience_snapshot_id);

-- Frozen audience snapshots are authoritative historical inputs. Once locked,
-- neither snapshot metadata nor membership rows may be mutated in place.
CREATE TRIGGER IF NOT EXISTS trg_competition_audience_snapshot_locked_update
BEFORE UPDATE ON competition_audience_snapshots
WHEN OLD.status = 'LOCKED'
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_audience_snapshot_locked_delete
BEFORE DELETE ON competition_audience_snapshots
WHEN OLD.status = 'LOCKED'
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_audience_member_locked_insert
BEFORE INSERT ON competition_audience_members
WHEN EXISTS (
  SELECT 1 FROM competition_audience_snapshots
  WHERE id = NEW.audience_snapshot_id AND status = 'LOCKED'
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_audience_member_locked_update
BEFORE UPDATE ON competition_audience_members
WHEN EXISTS (
  SELECT 1 FROM competition_audience_snapshots
  WHERE id = OLD.audience_snapshot_id AND status = 'LOCKED'
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_audience_member_locked_delete
BEFORE DELETE ON competition_audience_members
WHEN EXISTS (
  SELECT 1 FROM competition_audience_snapshots
  WHERE id = OLD.audience_snapshot_id AND status = 'LOCKED'
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE INDEX IF NOT EXISTS idx_competition_quiz_snapshots_quiz_created
  ON competition_quiz_snapshots(quiz_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_competition_rounds_campaign_window
  ON competition_rounds(campaign_id, status, opens_at, closes_at, round_number);

CREATE INDEX IF NOT EXISTS idx_competition_round_attempts_student_round
  ON competition_round_attempts(student_id, round_id, attempt_no DESC);

CREATE INDEX IF NOT EXISTS idx_competition_round_attempts_campaign_status
  ON competition_round_attempts(campaign_id, status, round_id, student_id);

CREATE INDEX IF NOT EXISTS idx_competition_round_attempts_result
  ON competition_round_attempts(result_id)
  WHERE result_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competition_round_progress_dashboard
  ON competition_round_progress(campaign_id, round_id, status, is_passed, student_id);

CREATE INDEX IF NOT EXISTS idx_competition_round_progress_student
  ON competition_round_progress(student_id, campaign_id, round_id);

CREATE INDEX IF NOT EXISTS idx_competition_eligibility_campaign_version
  ON competition_eligibility(campaign_id, eligibility_snapshot_version, qualified, student_id);

CREATE INDEX IF NOT EXISTS idx_competition_eligibility_student
  ON competition_eligibility(student_id, campaign_id, eligibility_snapshot_version DESC);

-- Eligibility versions are append-only historical snapshots. Administrative
-- exceptions create a new version rather than mutating rows already referenced
-- by downstream school-exam workflows.
CREATE TRIGGER IF NOT EXISTS trg_competition_eligibility_immutable_update
BEFORE UPDATE ON competition_eligibility
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_ELIGIBILITY_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_eligibility_immutable_delete
BEFORE DELETE ON competition_eligibility
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_ELIGIBILITY_IMMUTABLE');
END;
