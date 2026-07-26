ALTER TABLE questions ADD COLUMN tags TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_questions_tags ON questions(tags);
