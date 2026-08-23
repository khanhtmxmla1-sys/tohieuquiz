CREATE TABLE competition_school_exam_result_corrections (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  canonical_result_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  source_publication_id TEXT NOT NULL,
  source_publication_version INTEGER NOT NULL CHECK (source_publication_version > 0),
  before_score REAL NOT NULL CHECK (before_score >= 0 AND before_score <= 100),
  before_correct_count INTEGER CHECK (before_correct_count IS NULL OR before_correct_count >= 0),
  before_time_taken INTEGER CHECK (before_time_taken IS NULL OR before_time_taken >= 0),
  corrected_score REAL NOT NULL CHECK (corrected_score >= 0 AND corrected_score <= 100),
  corrected_correct_count INTEGER CHECK (corrected_correct_count IS NULL OR corrected_correct_count >= 0),
  corrected_time_taken INTEGER CHECK (corrected_time_taken IS NULL OR corrected_time_taken >= 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  request_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  before_hash TEXT NOT NULL CHECK (length(before_hash) = 64),
  after_hash TEXT NOT NULL CHECK (length(after_hash) = 64),
  applied_publication_id TEXT,
  applied_publication_version INTEGER CHECK (applied_publication_version IS NULL OR applied_publication_version > 0),
  applied_at TEXT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE RESTRICT,
  FOREIGN KEY (canonical_result_id) REFERENCES competition_school_exam_results(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (source_publication_id) REFERENCES competition_school_exam_publications(id) ON DELETE RESTRICT,
  FOREIGN KEY (applied_publication_id) REFERENCES competition_school_exam_publications(id) ON DELETE RESTRICT,
  UNIQUE(event_id, request_id)
);

CREATE INDEX idx_competition_result_corrections_event
  ON competition_school_exam_result_corrections(event_id, source_publication_version, created_at);

CREATE UNIQUE INDEX idx_competition_result_corrections_pending_student
  ON competition_school_exam_result_corrections(event_id, student_id)
  WHERE applied_publication_id IS NULL;

CREATE TRIGGER trg_competition_result_corrections_no_delete
BEFORE DELETE ON competition_school_exam_result_corrections
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_RESULT_CORRECTION_IMMUTABLE');
END;

CREATE TRIGGER trg_competition_result_corrections_immutable
BEFORE UPDATE ON competition_school_exam_result_corrections
WHEN OLD.id <> NEW.id
  OR OLD.event_id <> NEW.event_id
  OR OLD.canonical_result_id <> NEW.canonical_result_id
  OR OLD.student_id <> NEW.student_id
  OR OLD.source_publication_id <> NEW.source_publication_id
  OR OLD.source_publication_version <> NEW.source_publication_version
  OR OLD.before_score <> NEW.before_score
  OR OLD.before_correct_count IS NOT NEW.before_correct_count
  OR OLD.before_time_taken IS NOT NEW.before_time_taken
  OR OLD.corrected_score <> NEW.corrected_score
  OR OLD.corrected_correct_count IS NOT NEW.corrected_correct_count
  OR OLD.corrected_time_taken IS NOT NEW.corrected_time_taken
  OR OLD.reason <> NEW.reason
  OR OLD.request_id <> NEW.request_id
  OR OLD.created_by <> NEW.created_by
  OR OLD.created_at <> NEW.created_at
  OR OLD.before_hash <> NEW.before_hash
  OR OLD.after_hash <> NEW.after_hash
  OR OLD.applied_publication_id IS NOT NULL
  OR NEW.applied_publication_id IS NULL
  OR NEW.applied_publication_version IS NULL
  OR NEW.applied_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_RESULT_CORRECTION_IMMUTABLE');
END;
