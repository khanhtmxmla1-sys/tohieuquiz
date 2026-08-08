-- Add structured presentation data for rich question prompts while keeping
-- questions.question as the plain-text compatibility/grading/search fallback.
ALTER TABLE questions
ADD COLUMN question_rich_text TEXT NOT NULL DEFAULT '';
