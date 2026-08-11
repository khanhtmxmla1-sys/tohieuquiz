-- Canonical result class ownership. Additive only: unresolved legacy rows remain NULL.
ALTER TABLE results ADD COLUMN class_id TEXT REFERENCES classes(id) ON DELETE SET NULL;

-- 1) Assignment scope is the strongest historical evidence.
UPDATE results
SET class_id = (
  SELECT a.class_id
  FROM assignments a
  WHERE a.id = results.assignment_id
  LIMIT 1
)
WHERE class_id IS NULL
  AND COALESCE(TRIM(assignment_id), '') <> ''
  AND EXISTS (
    SELECT 1 FROM assignments a WHERE a.id = results.assignment_id
  );

-- 2) Student scope is accepted only when the student's current class still agrees
-- with the display class recorded on the result.
UPDATE results
SET class_id = (
  SELECT s.class_id
  FROM students s
  INNER JOIN classes c ON c.id = s.class_id
  WHERE s.id = results.student_id
    AND LOWER(TRIM(c.name)) = LOWER(TRIM(results.class_name))
  LIMIT 1
)
WHERE class_id IS NULL
  AND COALESCE(TRIM(student_id), '') <> ''
  AND EXISTS (
    SELECT 1
    FROM students s
    INNER JOIN classes c ON c.id = s.class_id
    WHERE s.id = results.student_id
      AND LOWER(TRIM(c.name)) = LOWER(TRIM(results.class_name))
  );

-- 3) Pure legacy rows without assignment/student evidence may use a normalized
-- class name only when that name identifies exactly one class in the whole DB.
-- Rows carrying conflicting canonical hints are deliberately left unresolved.
UPDATE results
SET class_id = (
  SELECT MIN(c.id)
  FROM classes c
  WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(results.class_name))
)
WHERE class_id IS NULL
  AND COALESCE(TRIM(assignment_id), '') = ''
  AND COALESCE(TRIM(student_id), '') = ''
  AND COALESCE(TRIM(class_name), '') <> ''
  AND (
    SELECT COUNT(*)
    FROM classes c
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(results.class_name))
  ) = 1;

CREATE INDEX IF NOT EXISTS idx_results_class_submitted
  ON results(class_id, submitted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_results_class_quiz_submitted
  ON results(class_id, quiz_id, submitted_at DESC, id DESC);
