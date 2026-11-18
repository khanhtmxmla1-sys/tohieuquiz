import type { LiveExamSession } from '../../../src/types/liveExam.types';
import type { D1Database } from '@cloudflare/workers-types';
import {
  decodeStudentAnswersForGrading,
  deriveStudentQuizDtoKey,
  encodeStudentAnswersForPresentation,
  hasOpaqueStudentAnswerIds,
  StudentQuizQuestionDtoError,
  toStudentQuestionDto,
  type StudentQuizQuestionDtoContext,
} from './studentQuizQuestionDto';
import { loadLiveExamQuiz } from './liveExam/quizLoader';

export interface LiveExamQuestionContract {
  quiz: Awaited<ReturnType<typeof loadLiveExamQuiz>>;
  context: StudentQuizQuestionDtoContext;
}

export const isLiveExamQuestionContractError = (error: unknown): boolean => (
  error instanceof StudentQuizQuestionDtoError
);

export const LIVE_EXAM_DTO_SNAPSHOT_MARKER = '__tohieuquiz_student_dto_v1';

interface LiveExamDtoSnapshotEnvelope {
  [LIVE_EXAM_DTO_SNAPSHOT_MARKER]: { version: 1; quizId: string; revision: number };
  answers: Record<string, unknown>;
}

export function wrapLiveExamDtoSnapshot(
  answers: Record<string, unknown>,
  contract: LiveExamQuestionContract,
): LiveExamDtoSnapshotEnvelope {
  return {
    [LIVE_EXAM_DTO_SNAPSHOT_MARKER]: {
      version: 1,
      quizId: contract.context.quizId,
      revision: contract.context.revision,
    },
    answers,
  };
}

export function readLiveExamDtoSnapshot(value: unknown): LiveExamDtoSnapshotEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const marker = record[LIVE_EXAM_DTO_SNAPSHOT_MARKER];
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return null;
  const metadata = marker as Record<string, unknown>;
  const revision = typeof metadata.revision === 'number' ? metadata.revision : NaN;
  if (metadata.version !== 1 || typeof metadata.quizId !== 'string'
    || !Number.isSafeInteger(revision) || revision < 1
    || !record.answers || typeof record.answers !== 'object' || Array.isArray(record.answers)) {
    return null;
  }
  return {
    [LIVE_EXAM_DTO_SNAPSHOT_MARKER]: {
      version: 1,
      quizId: metadata.quizId,
      revision,
    },
    answers: record.answers as Record<string, unknown>,
  };
}

export { hasOpaqueStudentAnswerIds };

/**
 * Build the server-owned presentation/scoring contract for one live attempt.
 * The session ID is part of the scope so a quiz payload cannot be replayed in
 * another live room, even when both rooms use the same quiz revision.
 */
export async function loadLiveExamQuestionContract(
  db: D1Database,
  session: LiveExamSession,
  studentId: string,
  secret: string,
): Promise<LiveExamQuestionContract> {
  const revisionRow = await db.prepare('SELECT revision FROM quizzes WHERE id = ? LIMIT 1')
    .bind(session.quizId)
    .first<{ revision?: number | null }>();
  const revision = Number(revisionRow?.revision || 1);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('Live quiz revision is invalid');
  }
  const quiz = await loadLiveExamQuiz(db, session);
  const key = await deriveStudentQuizDtoKey(secret);
  const scope = JSON.stringify([
    'live-exam-student-question-dto-v1',
    session.id,
    studentId,
    session.quizId,
    revision,
  ]);
  return {
    quiz,
    context: { quizId: session.quizId, revision, scope, key },
  };
}

export async function mapLiveExamQuestionsToStudentDto(
  contract: LiveExamQuestionContract,
) {
  return Promise.all(contract.quiz.questions.map((question) => (
    toStudentQuestionDto(question, contract.context)
  )));
}

export async function decodeLiveExamAnswers(
  contract: LiveExamQuestionContract,
  answers: unknown,
) {
  return decodeStudentAnswersForGrading(
    contract.quiz.questions as unknown[],
    answers,
    contract.context,
  );
}

export async function encodeLiveExamAnswers(
  contract: LiveExamQuestionContract,
  answers: unknown,
) {
  return encodeStudentAnswersForPresentation(
    contract.quiz.questions as unknown[],
    answers,
    contract.context,
  );
}
