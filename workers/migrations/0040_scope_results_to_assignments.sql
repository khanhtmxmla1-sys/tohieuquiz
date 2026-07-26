-- Scope quiz results and attempt counts to the exact assignment instance.
ALTER TABLE results ADD COLUMN assignment_id TEXT REFERENCES assignments(id) ON DELETE SET NULL;

-- Best-effort backfill: select the most recent applicable assignment created before submission.
UPDATE results AS result
SET assignment_id = (
  SELECT assignment.id
  FROM assignments AS assignment
  JOIN classes AS classroom ON classroom.id = assignment.class_id
  LEFT JOIN students AS student
    ON student.class_id = assignment.class_id
   AND LOWER(TRIM(student.full_name)) = LOWER(TRIM(result.student_name))
  WHERE assignment.quiz_id = result.quiz_id
    AND LOWER(TRIM(classroom.name)) = LOWER(TRIM(result.class_name))
    AND (COALESCE(assignment.student_id, '') = '' OR assignment.student_id = student.id)
    AND datetime(assignment.created_at) <= datetime(result.submitted_at)
  ORDER BY
    CASE WHEN assignment.student_id = student.id THEN 0 ELSE 1 END,
    datetime(assignment.created_at) DESC
  LIMIT 1
)
WHERE COALESCE(assignment_id, '') = '';

CREATE INDEX IF NOT EXISTS idx_results_assignment_student
  ON results(assignment_id, student_id, submitted_at);
