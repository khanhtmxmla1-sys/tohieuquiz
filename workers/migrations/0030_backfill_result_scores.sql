-- Reconcile legacy result totals only when every expected answer has a boolean
-- isCorrect marker. Plain/ungraded legacy answers are intentionally untouched.
WITH derived AS (
  SELECT
    results.id,
    results.total_questions,
    SUM(
      CASE WHEN json_valid(answer.value) = 1
        THEN CASE WHEN json_extract(answer.value, '$.isCorrect') = 1 THEN 1 ELSE 0 END
        ELSE 0
      END
    ) AS derived_correct_count
  FROM results
  JOIN json_each(results.answers) AS answer
  WHERE json_valid(results.answers) = 1
    AND results.total_questions > 0
    AND substr(answer.key, 1, 1) <> '_'
    AND CASE WHEN json_valid(answer.value) = 1
      THEN json_type(answer.value, '$.isCorrect')
      ELSE NULL
    END IN ('true', 'false')
  GROUP BY results.id, results.total_questions
  HAVING COUNT(*) = results.total_questions
)
UPDATE results
SET
  correct_count = (
    SELECT derived.derived_correct_count
    FROM derived
    WHERE derived.id = results.id
  ),
  score = (
    SELECT ROUND(derived.derived_correct_count * 10.0 / derived.total_questions, 1)
    FROM derived
    WHERE derived.id = results.id
  )
WHERE id IN (
  SELECT derived.id
  FROM derived
  WHERE results.correct_count <> derived.derived_correct_count
     OR ABS(results.score - ROUND(derived.derived_correct_count * 10.0 / derived.total_questions, 1)) > 0.001
);
