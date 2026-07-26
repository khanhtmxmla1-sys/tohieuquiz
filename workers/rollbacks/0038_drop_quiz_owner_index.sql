-- Ownership values normalized by migration 0038 are intentionally not reverted:
-- restoring mutable display names would recreate broken authorization.
DROP INDEX IF EXISTS idx_quizzes_created_by;
