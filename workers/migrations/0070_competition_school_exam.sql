-- Competition V1 school-exam persistence and additive Live Exam participant scope.
-- Existing class Live Exam sessions remain CLASS + PUBLISHED; competition rooms
-- must be SCHOOL_EXAM_ROOM + WITHHELD until publication is explicitly reconciled.

ALTER TABLE live_exam_sessions ADD COLUMN participant_scope_type TEXT NOT NULL DEFAULT 'CLASS'
  CHECK (participant_scope_type IN ('CLASS', 'SCHOOL_EXAM_ROOM'));
ALTER TABLE live_exam_sessions ADD COLUMN participant_scope_id TEXT;
ALTER TABLE live_exam_sessions ADD COLUMN result_visibility TEXT NOT NULL DEFAULT 'PUBLISHED'
  CHECK (result_visibility IN ('WITHHELD', 'PUBLISHED'));

UPDATE live_exam_sessions
SET participant_scope_id = class_id
WHERE participant_scope_type = 'CLASS'
  AND participant_scope_id IS NULL
  AND class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS competition_school_exam_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  eligibility_snapshot_version INTEGER NOT NULL CHECK (eligibility_snapshot_version > 0),
  title TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'PREFLIGHT_BLOCKED', 'READY', 'SCHEDULED', 'IN_PROGRESS',
      'WITHHELD', 'RECONCILING', 'READY_TO_PUBLISH', 'PUBLISHED'
    )),
  ranking_policy TEXT NOT NULL DEFAULT 'SCORE_CORRECT_TIME'
    CHECK (ranking_policy IN ('SCORE_CORRECT_TIME')),
  exam_form_policy TEXT NOT NULL DEFAULT 'SAME_FORM'
    CHECK (exam_form_policy IN ('SAME_FORM', 'EQUIVALENT_FORM_SET')),
  capacity_profile_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE RESTRICT,
  UNIQUE (campaign_id, id)
);

CREATE TABLE IF NOT EXISTS competition_school_exam_rooms (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  room_code TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 300),
  check_in_lead_minutes INTEGER NOT NULL DEFAULT 0 CHECK (check_in_lead_minutes BETWEEN 0 AND 120),
  close_drain_minutes INTEGER NOT NULL DEFAULT 0 CHECK (close_drain_minutes BETWEEN 0 AND 120),
  form_code TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  quiz_snapshot_id TEXT,
  live_exam_session_id TEXT,
  invigilator_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'READY', 'SCHEDULED', 'IN_PROGRESS', 'WITHHELD', 'RECONCILING', 'READY_TO_PUBLISH', 'PUBLISHED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, room_code),
  UNIQUE (live_exam_session_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
  FOREIGN KEY (quiz_snapshot_id) REFERENCES competition_quiz_snapshots(id) ON DELETE RESTRICT,
  FOREIGN KEY (live_exam_session_id) REFERENCES live_exam_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_school_exam_members (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  eligibility_snapshot_version INTEGER NOT NULL CHECK (eligibility_snapshot_version > 0),
  status TEXT NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status IN ('ASSIGNED', 'CHECKED_IN', 'STARTED', 'SUBMITTED', 'ABSENT', 'VOID', 'RETEST_APPROVED')),
  assigned_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, student_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS competition_school_exam_results (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  live_exam_session_id TEXT NOT NULL,
  live_exam_participant_id TEXT,
  score REAL CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  correct_count INTEGER CHECK (correct_count IS NULL OR correct_count >= 0),
  time_taken INTEGER CHECK (time_taken IS NULL OR time_taken >= 0),
  rank INTEGER CHECK (rank IS NULL OR rank > 0),
  status TEXT NOT NULL DEFAULT 'WITHHELD'
    CHECK (status IN ('WITHHELD', 'RECONCILED', 'VOID', 'PUBLISHED')),
  source_result_id INTEGER,
  computed_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (event_id, student_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (live_exam_session_id) REFERENCES live_exam_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (live_exam_participant_id) REFERENCES live_exam_participants(id) ON DELETE SET NULL,
  FOREIGN KEY (source_result_id) REFERENCES results(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_school_exam_incidents (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  room_id TEXT,
  student_id TEXT,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  details_json TEXT NOT NULL DEFAULT '{}',
  reported_by TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution_json TEXT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_school_exam_retests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  source_result_id TEXT,
  replacement_room_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'APPROVED', 'DENIED', 'PROVISIONED', 'COMPLETED', 'VOID')),
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (source_result_id) REFERENCES competition_school_exam_results(id) ON DELETE SET NULL,
  FOREIGN KEY (replacement_room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_school_exam_reconcile_runs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'RUNNING', 'BLOCKED', 'SUCCEEDED', 'FAILED')),
  request_id TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  started_by TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (event_id, request_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competition_school_exam_publications (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'PREPARED' CHECK (status IN ('PREPARED', 'PUBLISHED', 'SUPERSEDED')),
  result_digest TEXT NOT NULL,
  published_by TEXT,
  prepared_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (event_id, version),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competition_school_exam_exports (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  publication_version INTEGER,
  scope TEXT NOT NULL CHECK (scope IN ('SCHOOL', 'CLASS')),
  class_id TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  request_id TEXT NOT NULL,
  artifact_key TEXT,
  error_code TEXT,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (event_id, request_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  CHECK (scope <> 'CLASS' OR class_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS competition_school_exam_certificate_batches (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  publication_version INTEGER NOT NULL CHECK (publication_version > 0),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  request_id TEXT NOT NULL,
  artifact_key TEXT,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (event_id, request_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competition_school_exam_audit (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  room_id TEXT,
  student_id TEXT,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  request_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_school_exam_events_campaign_status
  ON competition_school_exam_events(campaign_id, status, exam_date, id);
CREATE INDEX IF NOT EXISTS idx_school_exam_rooms_event_status
  ON competition_school_exam_rooms(event_id, status, scheduled_at, id);
CREATE INDEX IF NOT EXISTS idx_school_exam_members_room_status
  ON competition_school_exam_members(room_id, status, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_results_event_status
  ON competition_school_exam_results(event_id, status, rank, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_incidents_event_room
  ON competition_school_exam_incidents(event_id, room_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_retests_event_status
  ON competition_school_exam_retests(event_id, status, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_reconcile_event_status
  ON competition_school_exam_reconcile_runs(event_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_publications_event_version
  ON competition_school_exam_publications(event_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_exports_event_status
  ON competition_school_exam_exports(event_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_certificate_batches_event_status
  ON competition_school_exam_certificate_batches(event_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_audit_event_created
  ON competition_school_exam_audit(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_participant_scope
  ON live_exam_sessions(participant_scope_type, participant_scope_id, status);

-- School-exam events must pin an eligibility snapshot version that already exists.
CREATE TRIGGER IF NOT EXISTS trg_school_exam_event_eligibility_insert
BEFORE INSERT ON competition_school_exam_events
WHEN NOT EXISTS (
  SELECT 1
  FROM competition_eligibility
  WHERE campaign_id = NEW.campaign_id
    AND eligibility_snapshot_version = NEW.eligibility_snapshot_version
)
BEGIN
  SELECT RAISE(ABORT, 'ELIGIBILITY_SNAPSHOT_VERSION_NOT_FOUND');
END;

CREATE TRIGGER IF NOT EXISTS trg_school_exam_event_eligibility_reference_immutable
BEFORE UPDATE OF campaign_id, eligibility_snapshot_version ON competition_school_exam_events
WHEN NEW.campaign_id <> OLD.campaign_id
  OR NEW.eligibility_snapshot_version <> OLD.eligibility_snapshot_version
BEGIN
  SELECT RAISE(ABORT, 'ELIGIBILITY_REFERENCE_IMMUTABLE');
END;

-- Preserve the existing class Live Exam path without forcing callers to know about
-- competition scoping. New class rows inherit CLASS + PUBLISHED and scope to class_id.
CREATE TRIGGER IF NOT EXISTS trg_live_exam_class_scope_insert
AFTER INSERT ON live_exam_sessions
WHEN NEW.participant_scope_type = 'CLASS'
  AND NEW.participant_scope_id IS NULL
  AND NEW.class_id IS NOT NULL
BEGIN
  UPDATE live_exam_sessions
  SET participant_scope_id = NEW.class_id
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_live_exam_class_visibility_insert
BEFORE INSERT ON live_exam_sessions
WHEN NEW.participant_scope_type = 'CLASS' AND NEW.result_visibility <> 'PUBLISHED'
BEGIN
  SELECT RAISE(ABORT, 'CLASS_RESULTS_MUST_BE_PUBLISHED');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_exam_school_class_forbidden_insert
BEFORE INSERT ON live_exam_sessions
WHEN NEW.participant_scope_type = 'SCHOOL_EXAM_ROOM'
  AND NEW.class_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_CLASS_SCOPE_FORBIDDEN');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_exam_school_scope_insert
BEFORE INSERT ON live_exam_sessions
WHEN NEW.participant_scope_type = 'SCHOOL_EXAM_ROOM'
  AND (
    NEW.result_visibility <> 'WITHHELD'
    OR NEW.participant_scope_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM competition_school_exam_rooms
      WHERE id = NEW.participant_scope_id
    )
  )
BEGIN
  SELECT RAISE(ABORT,
    CASE
      WHEN NEW.result_visibility <> 'WITHHELD' THEN 'SCHOOL_EXAM_RESULTS_MUST_BE_WITHHELD'
      ELSE 'SCHOOL_EXAM_ROOM_SCOPE_INVALID'
    END
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_live_exam_scope_update
BEFORE UPDATE OF class_id, participant_scope_type, participant_scope_id, result_visibility ON live_exam_sessions
WHEN (
  NEW.participant_scope_type = 'CLASS' AND NEW.result_visibility <> 'PUBLISHED'
) OR (
  NEW.participant_scope_type = 'SCHOOL_EXAM_ROOM'
  AND (
    NEW.class_id IS NOT NULL
    OR NEW.result_visibility <> 'WITHHELD'
    OR NEW.participant_scope_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM competition_school_exam_rooms
      WHERE id = NEW.participant_scope_id
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'LIVE_EXAM_SCOPE_VISIBILITY_INVALID');
END;
