DROP INDEX IF EXISTS idx_live_exam_control_audit_session_created;
DROP TABLE IF EXISTS live_exam_control_audit;
DROP INDEX IF EXISTS idx_live_exam_control_confirmations_lookup;
DROP TABLE IF EXISTS live_exam_control_confirmations;

-- paused_at, total_paused_seconds and individual_ends_at are intentionally retained.
-- They are nullable/defaulted compatibility columns; removing them safely requires
-- rebuilding the live exam tables in SQLite/D1.
