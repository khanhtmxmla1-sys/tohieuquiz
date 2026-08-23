DROP TRIGGER IF EXISTS trg_school_exam_result_delete_forbidden;
DROP INDEX IF EXISTS idx_school_exam_result_history_event_student;
DROP TABLE IF EXISTS competition_school_exam_result_history;
DROP INDEX IF EXISTS idx_school_exam_retests_live_session;
DROP INDEX IF EXISTS idx_school_exam_retests_grant_request;
DROP INDEX IF EXISTS idx_school_exam_retests_incident;
DROP INDEX IF EXISTS idx_school_exam_incidents_event_request;

ALTER TABLE competition_school_exam_results DROP COLUMN reconcile_version;
ALTER TABLE competition_school_exam_results DROP COLUMN resolution;
ALTER TABLE competition_school_exam_results DROP COLUMN retest_id;

ALTER TABLE competition_school_exam_retests DROP COLUMN resolution;
ALTER TABLE competition_school_exam_retests DROP COLUMN live_exam_session_id;
ALTER TABLE competition_school_exam_retests DROP COLUMN expires_at;
ALTER TABLE competition_school_exam_retests DROP COLUMN grant_request_id;
ALTER TABLE competition_school_exam_retests DROP COLUMN reason_text;
ALTER TABLE competition_school_exam_retests DROP COLUMN reason_code;
ALTER TABLE competition_school_exam_retests DROP COLUMN incident_id;

ALTER TABLE competition_school_exam_incidents DROP COLUMN request_id;
