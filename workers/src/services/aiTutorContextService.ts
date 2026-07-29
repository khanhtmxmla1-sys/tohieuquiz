import type { AuthorizedAiTutorResult } from './aiTutorAuthorization';

export interface AiTutorQuestionContext {
  question: string;
  options: string[];
  correctAnswer: string;
}

type SavedAnswer = Record<string, unknown>;

const parseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
};

const normalizeOptions = (value: unknown): string[] => {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((option) => String(option ?? '').trim()).filter(Boolean).slice(0, 6);
};

const answerEntries = (raw: string | null): SavedAnswer[] => {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) return parsed.filter((entry): entry is SavedAnswer => Boolean(entry) && typeof entry === 'object');
  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).map(([questionId, value]) => (
      value && typeof value === 'object'
        ? { questionId, ...(value as SavedAnswer) }
        : { questionId, selectedAnswer: value }
    ));
  }
  return [];
};

const isWrong = (entry: SavedAnswer): boolean => (
  entry.isCorrect === false
  || entry.correct === false
  || entry.status === 'incorrect'
  || entry.status === 'wrong'
);

const snapshotContext = (entry: SavedAnswer): AiTutorQuestionContext | null => {
  const snapshot = (entry.questionSnapshot ?? entry.question ?? entry.snapshot) as SavedAnswer | string | undefined;
  if (!snapshot) return null;
  const object = typeof snapshot === 'object' ? snapshot : { question: snapshot };
  const question = String(object.question ?? object.mainQuestion ?? '').trim();
  const correctAnswer = String(object.correctAnswer ?? object.correct_answer ?? entry.correctAnswer ?? '').trim();
  if (!question || !correctAnswer) return null;
  return { question, options: normalizeOptions(object.options), correctAnswer };
};

export async function loadAiTutorWrongQuestionContext(
  db: D1Database,
  result: AuthorizedAiTutorResult,
): Promise<AiTutorQuestionContext[]> {
  const wrongEntries = answerEntries(result.answers).filter(isWrong).slice(0, 3);
  const snapshots = wrongEntries.map(snapshotContext).filter((value): value is AiTutorQuestionContext => Boolean(value));
  if (snapshots.length === wrongEntries.length && snapshots.length > 0) return snapshots;

  const questionIds = wrongEntries
    .map((entry) => String(entry.questionId ?? entry.question_id ?? entry.id ?? '').trim())
    .filter(Boolean)
    .slice(0, 3);
  if (questionIds.length === 0) return snapshots.slice(0, 3);

  const placeholders = questionIds.map(() => '?').join(',');
  const rows = await db.prepare(`
    SELECT id, question, options, correct_answer
    FROM questions
    WHERE quiz_id = ? AND id IN (${placeholders})
  `).bind(result.quiz_id, ...questionIds).all<{
    id: string;
    question: string;
    options: string | null;
    correct_answer: string;
  }>();

  const byId = new Map((rows.results ?? []).map((row) => [String(row.id), row]));
  return questionIds.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row)).map((row) => ({
    question: String(row.question ?? '').trim(),
    options: normalizeOptions(row.options),
    correctAnswer: String(row.correct_answer ?? '').trim(),
  })).filter((item) => item.question && item.correctAnswer).slice(0, 3);
}
