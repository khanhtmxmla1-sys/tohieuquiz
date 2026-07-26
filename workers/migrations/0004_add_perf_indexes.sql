-- Performance: Add index on results.submitted_at for ORDER BY DESC
CREATE INDEX IF NOT EXISTS idx_results_submitted_at ON results(submitted_at DESC);
