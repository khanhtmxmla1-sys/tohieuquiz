-- Destructive rollback: drops persisted rich question formatting.
-- Do not run during a normal application rollback without explicit approval.
ALTER TABLE questions DROP COLUMN question_rich_text;
