-- Rollback for 0016_add_live_exam_tables.sql
-- Destructive: every Live Exam session, participation record and answer payload
-- is removed. Export these tables before running this in production.
--
-- ORDER MATTERS: migrations 0017 (waiting room chat), 0018 (analytics) and
-- 0026 (hardening) build on top of these tables. Roll those back first, or run
-- this script last, otherwise their foreign keys will dangle.

DROP INDEX IF EXISTS idx_live_exam_activity_session;
DROP INDEX IF EXISTS idx_live_exam_participants_rank;
DROP INDEX IF EXISTS idx_live_exam_participants_student;
DROP INDEX IF EXISTS idx_live_exam_participants_session;
DROP INDEX IF EXISTS idx_live_exam_sessions_class;
DROP INDEX IF EXISTS idx_live_exam_sessions_teacher;
DROP INDEX IF EXISTS idx_live_exam_sessions_status;
DROP INDEX IF EXISTS idx_live_exam_sessions_access_code;

DROP TABLE IF EXISTS live_exam_activity;
DROP TABLE IF EXISTS live_exam_participants;
DROP TABLE IF EXISTS live_exam_sessions;
