-- Rollback for 0040_scope_results_to_assignments.sql
-- Removes the index that scopes results to a specific assignment instance.
-- Queries fall back to the pre-0040 behaviour of matching on quiz + class.

DROP INDEX IF EXISTS idx_results_assignment_student;

-- results.assignment_id is intentionally retained.
-- Dropping it would rewrite the results table (D1/SQLite cannot remove a column
-- carrying a REFERENCES clause in place) and the backfilled values are the only
-- record of which assignment each historical submission belonged to.
-- To neutralise the column without losing the table, clear it instead:
--   UPDATE results SET assignment_id = NULL;
