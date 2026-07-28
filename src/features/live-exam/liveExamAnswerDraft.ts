import type { StudentAnswers } from '../../types/liveExam.types';
import { createIdempotencyKey } from '../../utils/boundedRetry';

const STORAGE_PREFIX = 'tohieuquiz_live_exam_answers_v1:';
const MAX_DRAFT_BYTES = 100_000;

export interface LiveExamSubmissionAttempt {
  answerFingerprint: string;
  idempotencyKey: string;
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
};

export const serializeLiveExamAnswers = (answers: Record<string, unknown>): string => (
  JSON.stringify(stableValue(answers))
);

const getStorage = (storage?: Storage): Storage | null => {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

const storageKey = (sessionId: string): string => `${STORAGE_PREFIX}${sessionId}`;

export const loadLiveExamAnswerDraft = (
  sessionId: string,
  storage?: Storage,
): StudentAnswers => {
  const target = getStorage(storage);
  if (!target) return {};
  try {
    const raw = target.getItem(storageKey(sessionId));
    if (!raw || raw.length > MAX_DRAFT_BYTES) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return stableValue(parsed) as StudentAnswers;
  } catch {
    return {};
  }
};

export const saveLiveExamAnswerDraft = (
  sessionId: string,
  answers: Record<string, unknown>,
  storage?: Storage,
): void => {
  const target = getStorage(storage);
  if (!target) return;
  const serialized = serializeLiveExamAnswers(answers);
  if (new TextEncoder().encode(serialized).byteLength > MAX_DRAFT_BYTES) {
    throw new Error('Live Exam answer draft is too large.');
  }
  target.setItem(storageKey(sessionId), serialized);
};

export const clearLiveExamAnswerDraft = (sessionId: string, storage?: Storage): void => {
  getStorage(storage)?.removeItem(storageKey(sessionId));
};

export const createLiveExamSubmissionAttempt = (
  sessionId: string,
  answers: Record<string, unknown>,
  existing?: LiveExamSubmissionAttempt | null,
): LiveExamSubmissionAttempt => {
  const answerFingerprint = serializeLiveExamAnswers(answers);
  if (existing?.answerFingerprint === answerFingerprint) return existing;
  return {
    answerFingerprint,
    idempotencyKey: createIdempotencyKey(`live-exam-submit-${sessionId}`),
  };
};
