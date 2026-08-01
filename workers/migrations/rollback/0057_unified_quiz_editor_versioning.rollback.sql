-- D1 rollback for migration 0057. Run only after disabling the unified editor endpoints.
DROP INDEX IF EXISTS idx_quizzes_source_type;
DROP INDEX IF EXISTS idx_quizzes_parent_version;
ALTER TABLE quizzes DROP COLUMN updated_at;
ALTER TABLE quizzes DROP COLUMN revision;
ALTER TABLE quizzes DROP COLUMN version_number;
ALTER TABLE quizzes DROP COLUMN parent_quiz_id;
ALTER TABLE quizzes DROP COLUMN source_type;
