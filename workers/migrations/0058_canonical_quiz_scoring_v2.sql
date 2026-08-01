-- Canonical quiz scoring engine schema versioning.
-- Additive only: existing questions and results remain legacy until rewritten by normal application flows.
ALTER TABLE questions ADD COLUMN answer_schema_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE results ADD COLUMN grading_version TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE live_exam_participants ADD COLUMN grading_version TEXT;
