export interface QuizAttemptDraft {
  version: 1;
  quizId: string;
  studentName: string;
  studentClass: string;
  answers: Record<string, unknown>;
  questionOrder: string[];
  currentPage: number;
  startedAt: string;
  expiresAt: string | null;
}

const STORAGE_PREFIX = 'tohieuquiz_quiz_attempt_v1:';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isIsoDate = (value: unknown): value is string => (
  typeof value === 'string' && Number.isFinite(Date.parse(value))
);

export const quizAttemptStorageKey = (quizId: string): string => (
  `${STORAGE_PREFIX}${String(quizId || '').trim()}`
);

const parseDraft = (value: unknown, quizId: string): QuizAttemptDraft | null => {
  if (!isRecord(value)) return null;
  if (value.version !== 1 || value.quizId !== quizId) return null;
  if (typeof value.studentName !== 'string' || typeof value.studentClass !== 'string') return null;
  if (!isRecord(value.answers)) return null;
  if (!Array.isArray(value.questionOrder) || !value.questionOrder.every((id) => typeof id === 'string' && id.trim())) {
    return null;
  }
  if (!Number.isInteger(value.currentPage) || Number(value.currentPage) < 1) return null;
  if (!isIsoDate(value.startedAt)) return null;
  const rawExpiresAt = value.expiresAt;
  let expiresAt: string | null = null;
  if (rawExpiresAt !== null) {
    if (!isIsoDate(rawExpiresAt)) return null;
    expiresAt = rawExpiresAt;
  }

  return {
    version: 1,
    quizId,
    studentName: value.studentName,
    studentClass: value.studentClass,
    answers: { ...value.answers },
    questionOrder: [...value.questionOrder],
    currentPage: Number(value.currentPage),
    startedAt: value.startedAt,
    expiresAt,
  };
};

export const loadQuizAttemptDraft = (quizId: string): QuizAttemptDraft | null => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const normalizedQuizId = String(quizId || '').trim();
  if (!normalizedQuizId) return null;
  const key = quizAttemptStorageKey(normalizedQuizId);
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = parseDraft(JSON.parse(raw), normalizedQuizId);
    if (!parsed) window.sessionStorage.removeItem(key);
    return parsed;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
};

export const saveQuizAttemptDraft = (draft: QuizAttemptDraft): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const parsed = parseDraft(draft, draft.quizId);
  if (!parsed) return;
  window.sessionStorage.setItem(quizAttemptStorageKey(parsed.quizId), JSON.stringify(parsed));
};

export const clearQuizAttemptDraft = (quizId: string): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  window.sessionStorage.removeItem(quizAttemptStorageKey(quizId));
};
