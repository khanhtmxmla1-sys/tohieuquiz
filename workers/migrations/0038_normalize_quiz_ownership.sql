-- Normalize legacy quiz ownership to immutable teacher usernames.
-- Historical rows used teacher display names, which prevented teachers from
-- selecting their own quizzes in Live Exam and from loading full question data.

UPDATE quizzes
SET created_by = (
  SELECT t.username
  FROM teachers t
  WHERE LOWER(TRIM(t.full_name)) = LOWER(TRIM(quizzes.created_by))
  LIMIT 1
)
WHERE TRIM(COALESCE(quizzes.created_by, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM teachers canonical
    WHERE LOWER(TRIM(canonical.username)) = LOWER(TRIM(quizzes.created_by))
  )
  AND (
    SELECT COUNT(*)
    FROM teachers t
    WHERE LOWER(TRIM(t.full_name)) = LOWER(TRIM(quizzes.created_by))
  ) = 1;

-- Known historical spelling used by the same account before usernames became
-- the canonical ownership key. Resolve it through the unique current display
-- name instead of hardcoding an account username or using unsafe fuzzy matching.
UPDATE quizzes
SET created_by = (
  SELECT t.username
  FROM teachers t
  WHERE LOWER(TRIM(t.full_name)) = LOWER(TRIM('Thầy Khánh đẹp Choai'))
  LIMIT 1
)
WHERE LOWER(TRIM(created_by)) = LOWER(TRIM('Thầy Khánh đẹp troai'))
  AND (
    SELECT COUNT(*)
    FROM teachers t
    WHERE LOWER(TRIM(t.full_name)) = LOWER(TRIM('Thầy Khánh đẹp Choai'))
  ) = 1;

-- Blank or otherwise unresolvable owners are intentionally left untouched.
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
