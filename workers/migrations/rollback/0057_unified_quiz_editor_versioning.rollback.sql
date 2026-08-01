-- Safe rollback posture for migration 0057.
-- Disable or redeploy the unified editor endpoints first, then remove only the
-- optional indexes. The additive quiz columns are intentionally retained to
-- avoid destructive production schema changes; use D1 Time Travel only when a
-- full database restore has been explicitly approved.
DROP INDEX IF EXISTS idx_quizzes_source_type;
DROP INDEX IF EXISTS idx_quizzes_parent_version;
