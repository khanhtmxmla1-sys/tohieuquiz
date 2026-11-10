export const DEFAULT_PRACTICE_LIMIT = 10;
export const MAX_PRACTICE_LIMIT = 50;

const PRACTICE_TAG_PATTERN = /^#[^\s,]+$/u;

/**
 * The practice pool is intentionally narrower than the set of quizzes visible
 * on the home page. Any quiz referenced by a protected workflow is excluded,
 * including pre-live school-exam rooms and competition snapshots/mappings.
 */
export const PUBLIC_PRACTICE_SOURCE_SCOPE_SQL = `
FROM questions AS q
INNER JOIN quizzes AS public_quiz ON public_quiz.id = q.quiz_id
WHERE UPPER(TRIM(CAST(COALESCE(public_quiz.show_on_home, 'FALSE') AS TEXT))) = 'TRUE'
  AND UPPER(TRIM(CAST(COALESCE(public_quiz.require_code, 'FALSE') AS TEXT))) IN ('', 'FALSE', '0')
  AND q.quiz_id NOT IN (
    SELECT protected_quiz_id
    FROM (
      SELECT practice_assignment.quiz_id AS protected_quiz_id
      FROM assignments AS practice_assignment
      WHERE practice_assignment.quiz_id IS NOT NULL
      UNION ALL
      SELECT practice_live_exam.quiz_id AS protected_quiz_id
      FROM live_exam_sessions AS practice_live_exam
      WHERE practice_live_exam.quiz_id IS NOT NULL
      UNION ALL
      SELECT practice_competition_quiz.quiz_id AS protected_quiz_id
      FROM competition_round_quizzes AS practice_competition_quiz
      WHERE practice_competition_quiz.quiz_id IS NOT NULL
      UNION ALL
      SELECT practice_competition_snapshot.quiz_id AS protected_quiz_id
      FROM competition_quiz_snapshots AS practice_competition_snapshot
      WHERE practice_competition_snapshot.quiz_id IS NOT NULL
      UNION ALL
      SELECT practice_school_exam_room.quiz_id AS protected_quiz_id
      FROM competition_school_exam_rooms AS practice_school_exam_room
      WHERE practice_school_exam_room.quiz_id IS NOT NULL
    ) AS protected_practice_quizzes
  )`;

export function normalizePracticeTopic(rawTopic: string | null): string | null {
  if (rawTopic === null) return null;
  const trimmed = rawTopic.trim();
  if (!trimmed || trimmed.length > 128 || trimmed.includes('%') || trimmed.includes('*')) return null;
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return PRACTICE_TAG_PATTERN.test(normalized) ? normalized : null;
}

export function parsePracticeLimit(rawLimit: string | null): number | null {
  if (rawLimit === null) return DEFAULT_PRACTICE_LIMIT;
  if (!/^\d+$/u.test(rawLimit)) return null;
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PRACTICE_LIMIT) return null;
  return limit;
}

export function extractPracticeTags(rawTags: unknown): string[] {
  if (typeof rawTags !== 'string') return [];
  return Array.from(new Set(
    rawTags
      .split(/[ \t\r\n,]+/u)
      .map((tag) => tag.trim())
      .filter((tag) => PRACTICE_TAG_PATTERN.test(tag)),
  ));
}
