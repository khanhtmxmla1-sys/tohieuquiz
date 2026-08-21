-- Competition V1 Task 15: immutable publication versions and ranking snapshots.
-- Rankings are materialized from canonical results at publish time so later
-- corrections can create a new version without rewriting prior official data.

ALTER TABLE competition_school_exam_publications ADD COLUMN ranking_version INTEGER
  CHECK (ranking_version IS NULL OR ranking_version > 0);
ALTER TABLE competition_school_exam_publications ADD COLUMN request_id TEXT;
ALTER TABLE competition_school_exam_publications ADD COLUMN reconcile_version INTEGER
  CHECK (reconcile_version IS NULL OR reconcile_version > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_publications_event_request
  ON competition_school_exam_publications(event_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_publications_event_ranking_version
  ON competition_school_exam_publications(event_id, ranking_version)
  WHERE ranking_version IS NOT NULL;

-- Task 12 correctly forced competition sessions to stay WITHHELD before publication.
-- Replace that update trigger with a publication-aware guard: creation is still
-- WITHHELD-only, while a later PUBLISHED transition requires a durable official
-- publication for the room's event.
DROP TRIGGER IF EXISTS trg_live_exam_scope_update;
CREATE TRIGGER trg_live_exam_scope_update
BEFORE UPDATE OF class_id, participant_scope_type, participant_scope_id, result_visibility ON live_exam_sessions
WHEN (
  NEW.participant_scope_type = 'CLASS' AND NEW.result_visibility <> 'PUBLISHED'
) OR (
  NEW.participant_scope_type = 'SCHOOL_EXAM_ROOM'
  AND (
    NEW.class_id IS NOT NULL
    OR NEW.result_visibility NOT IN ('WITHHELD', 'PUBLISHED')
    OR NEW.participant_scope_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM competition_school_exam_rooms
      WHERE id = NEW.participant_scope_id
    )
    OR (
      NEW.result_visibility = 'PUBLISHED'
      AND NOT EXISTS (
        SELECT 1
        FROM competition_school_exam_rooms AS rooms
        JOIN competition_school_exam_publications AS publications
          ON publications.event_id = rooms.event_id
         AND publications.status = 'PUBLISHED'
        WHERE rooms.id = NEW.participant_scope_id
      )
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'LIVE_EXAM_SCOPE_VISIBILITY_INVALID');
END;

CREATE TABLE IF NOT EXISTS competition_school_exam_publication_results (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  publication_version INTEGER NOT NULL CHECK (publication_version > 0),
  ranking_version INTEGER NOT NULL CHECK (ranking_version > 0),
  canonical_result_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  original_class_id TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  score REAL NOT NULL,
  correct_count INTEGER,
  time_taken INTEGER,
  rank_event INTEGER NOT NULL CHECK (rank_event > 0),
  rank_grade INTEGER NOT NULL CHECK (rank_grade > 0),
  rank_class INTEGER NOT NULL CHECK (rank_class > 0),
  source_reconcile_version INTEGER NOT NULL CHECK (source_reconcile_version > 0),
  published_at TEXT NOT NULL,
  UNIQUE (publication_id, student_id),
  UNIQUE (event_id, publication_version, student_id),
  FOREIGN KEY (publication_id) REFERENCES competition_school_exam_publications(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE RESTRICT,
  FOREIGN KEY (canonical_result_id) REFERENCES competition_school_exam_results(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (original_class_id) REFERENCES classes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_school_exam_publication_results_event
  ON competition_school_exam_publication_results(event_id, publication_version DESC, rank_event, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_publication_results_grade
  ON competition_school_exam_publication_results(event_id, publication_version DESC, grade_level, rank_grade, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_publication_results_class
  ON competition_school_exam_publication_results(event_id, publication_version DESC, original_class_id, rank_class, student_id);

CREATE TRIGGER IF NOT EXISTS trg_school_exam_publication_immutable_update
BEFORE UPDATE ON competition_school_exam_publications
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_PUBLICATION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_school_exam_publication_immutable_delete
BEFORE DELETE ON competition_school_exam_publications
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_PUBLICATION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_school_exam_publication_result_immutable_update
BEFORE UPDATE ON competition_school_exam_publication_results
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_PUBLICATION_RESULT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_school_exam_publication_result_immutable_delete
BEFORE DELETE ON competition_school_exam_publication_results
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_PUBLICATION_RESULT_IMMUTABLE');
END;
