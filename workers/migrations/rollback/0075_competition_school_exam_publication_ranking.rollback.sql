DROP TRIGGER IF EXISTS trg_school_exam_publication_result_immutable_delete;
DROP TRIGGER IF EXISTS trg_school_exam_publication_result_immutable_update;
DROP TRIGGER IF EXISTS trg_school_exam_publication_immutable_delete;
DROP TRIGGER IF EXISTS trg_school_exam_publication_immutable_update;
DROP INDEX IF EXISTS idx_school_exam_publication_results_class;
DROP INDEX IF EXISTS idx_school_exam_publication_results_grade;
DROP INDEX IF EXISTS idx_school_exam_publication_results_event;
DROP TABLE IF EXISTS competition_school_exam_publication_results;
DROP INDEX IF EXISTS idx_school_exam_publications_event_ranking_version;
DROP INDEX IF EXISTS idx_school_exam_publications_event_request;
DROP TRIGGER IF EXISTS trg_live_exam_scope_update;
CREATE TRIGGER trg_live_exam_scope_update
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
ALTER TABLE competition_school_exam_publications DROP COLUMN reconcile_version;
ALTER TABLE competition_school_exam_publications DROP COLUMN request_id;
ALTER TABLE competition_school_exam_publications DROP COLUMN ranking_version;
