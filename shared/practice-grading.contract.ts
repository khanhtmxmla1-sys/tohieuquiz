/**
 * Public practice's network grading contract.
 *
 * Keep this module deliberately free of runtime imports from the Worker or the
 * React application.  It is the wire contract shared by both sides of the
 * secure-practice rollout.
 */

import type { QuestionAnswerReview, QuestionGradingResult } from '../src/domain/quiz-scoring';

export const PRACTICE_DELIVERY_VERSION = 'server-v1' as const;
export const PRACTICE_SESSION_TTL_SECONDS = 24 * 60 * 60;
export const PRACTICE_MAX_SELECTED_QUESTIONS = 50;
export const PRACTICE_MAX_SESSION_TOKEN_BYTES = 32 * 1024;
export const PRACTICE_MAX_GRADE_BODY_BYTES = 256 * 1024;

/** These values are intentionally distinct from the login JWT contract. */
export const PRACTICE_SESSION_ISSUER = 'tohieuquiz-public-practice' as const;
export const PRACTICE_SESSION_AUDIENCE = 'tohieuquiz-public-practice-grading' as const;
export const PRACTICE_SESSION_PURPOSE = 'public-practice-selection' as const;

export interface PracticeSessionQuestionReference {
  questionId: string;
  quizId: string;
  revision: number;
  /** Keyed HMAC of the answer-bearing source row; never a plain digest. */
  fingerprint: string;
}

export interface PracticeSessionEnvelope {
  version: typeof PRACTICE_DELIVERY_VERSION;
  token: string;
  expiresAt: string;
}

export interface PracticeSessionClaims {
  iss: typeof PRACTICE_SESSION_ISSUER;
  aud: typeof PRACTICE_SESSION_AUDIENCE;
  purpose: typeof PRACTICE_SESSION_PURPOSE;
  version: typeof PRACTICE_DELIVERY_VERSION;
  iat: number;
  exp: number;
  sessionId: string;
  practiceId: string;
  selected: readonly PracticeSessionQuestionReference[];
}

export interface PracticeGradeRequest {
  sessionToken: string;
  answers: Record<string, unknown>;
  questionOrder?: string[];
}

/**
 * `answers`, `validationDetails`, and `reviewDetails` are authoritative output
 * from the Worker.  The response intentionally mirrors the persisted result
 * fields without being a persisted result or granting a saved-result side
 * effect.
 */
export interface PracticeGradeResponse {
  status: 'success';
  practiceId: string;
  score: number;
  correctCount: number;
  questionCount: number;
  totalQuestions: number;
  voidedCount: number;
  gradingVersion: string;
  answers: Record<string, unknown>;
  validationDetails: readonly QuestionGradingResult[];
  reviewDetails: readonly QuestionAnswerReview[];
}

export interface PracticeGradeError {
  status: 'error';
  code: string;
  message: string;
}

export type PracticeGradeResult = PracticeGradeResponse | PracticeGradeError;

export const isPlainRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

export const utf8ByteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const isPracticeTokenWithinLimit = (value: unknown): value is string => (
  typeof value === 'string'
  && value.length > 0
  && PRACTICE_MAX_SESSION_TOKEN_BYTES >= utf8ByteLength(value)
);

export const isPracticeSessionEnvelope = (value: unknown): value is PracticeSessionEnvelope => (
  isPlainRecord(value)
  && value.version === PRACTICE_DELIVERY_VERSION
  && isPracticeTokenWithinLimit(value.token)
  && typeof value.expiresAt === 'string'
  && Number.isFinite(Date.parse(value.expiresAt))
);

export const isPracticeGradeRequest = (value: unknown): value is PracticeGradeRequest => {
  if (!isPlainRecord(value) || typeof value.sessionToken !== 'string'
    || value.sessionToken.trim().length === 0
    || !isPracticeTokenWithinLimit(value.sessionToken)
    || !isPlainRecord(value.answers)) return false;
  if (value.questionOrder !== undefined
    && (!Array.isArray(value.questionOrder) || !value.questionOrder.every((id) => typeof id === 'string'))) {
    return false;
  }
  return true;
};
