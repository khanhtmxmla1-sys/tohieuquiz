-- Migration number: 0010
-- Add analytics_json column to store detailed question-level results for heatmap visualization

ALTER TABLE results ADD COLUMN analytics_json TEXT DEFAULT '[]';
ALTER TABLE hw_submissions ADD COLUMN analytics_json TEXT DEFAULT '[]';

-- Add index to queries for analytics
CREATE INDEX IF NOT EXISTS idx_hw_submissions_analytics ON hw_submissions(assignment_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_analytics ON results(class_name, submitted_at DESC);
