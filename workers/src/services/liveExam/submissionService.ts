import type { D1Database } from '@cloudflare/workers-types';
import { calculateStudentScore } from '../../../../src/features/quiz-player/utils/quizScoring';
import { LiveExamServiceError } from './errors';
import { loadLiveExamQuiz } from './quizLoader';
import { getLiveExamById } from './sessionRepository';
import type { SubmissionScoreSummary, SubmitAnswersParams } from './types';
import { getChangedRows, now } from './utils';

interface ParticipantSubmissionRow {
  id: string;
  submitted_at: string | null;
}

interface CommittedSubmissionRow {
  answers: string | null;
  score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  submitted_at: string | null;
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const answersMatch = (stored: string | null, incoming: unknown): boolean => {
  if (!stored) return false;
  try {
    return JSON.stringify(canonicalize(JSON.parse(stored)))
      === JSON.stringify(canonicalize(incoming));
  } catch {
    return false;
  }
};

const loadParticipantState = async (
  db: D1Database,
  liveExamId: string,
  studentId: string,
): Promise<ParticipantSubmissionRow | null> => db.prepare(`
    SELECT id, submitted_at FROM live_exam_participants
    WHERE live_exam_id = ? AND student_id = ?
  `).bind(liveExamId, studentId).first<ParticipantSubmissionRow>();

const loadCommittedSubmission = async (
  db: D1Database,
  liveExamId: string,
  studentId: string,
): Promise<CommittedSubmissionRow | null> => db.prepare(`
    SELECT answers, score, correct_count, wrong_count, submitted_at
    FROM live_exam_participants
    WHERE live_exam_id = ? AND student_id = ?
  `).bind(liveExamId, studentId).first<CommittedSubmissionRow>();

const replayCommittedSubmission = async (
  db: D1Database,
  params: SubmitAnswersParams,
): Promise<SubmissionScoreSummary> => {
  const committed = await loadCommittedSubmission(db, params.liveExamId, params.studentId);
  if (
    !committed?.submitted_at
    || committed.score === null
    || committed.correct_count === null
    || committed.wrong_count === null
    || !answersMatch(committed.answers, params.answers)
  ) {
    throw new LiveExamServiceError('Answers already submitted', 409);
  }
  return {
    score: Number(committed.score),
    correctCount: Number(committed.correct_count),
    wrongCount: Number(committed.wrong_count),
    submittedAt: committed.submitted_at,
  };
};

export async function submitAnswers(
  db: D1Database,
  params: SubmitAnswersParams,
): Promise<SubmissionScoreSummary> {
  const timestamp = now();
  const session = await getLiveExamById(db, params.liveExamId);
  if (!session || session.archivedAt) throw new LiveExamServiceError('Session not found', 404);

  const participant = await loadParticipantState(db, params.liveExamId, params.studentId);
  if (participant?.submitted_at) return replayCommittedSubmission(db, params);

  if (session.status !== 'active') throw new LiveExamServiceError('Exam is not active', 409);
  if (!session.endsAt || Date.parse(session.endsAt) <= Date.now()) {
    throw new LiveExamServiceError('Exam time has ended', 409);
  }
  if (!participant) throw new LiveExamServiceError('Forbidden: Join session first', 403);

  const quiz = await loadLiveExamQuiz(db, session);
  const grading = calculateStudentScore(quiz, params.answers || {});
  const wrongCount = Math.max(0, grading.totalItems - grading.correctCount);
  const result = await db.prepare(`
    UPDATE live_exam_participants
    SET answers = ?, submitted_at = ?, score = ?, correct_count = ?, wrong_count = ?, updated_at = ?
    WHERE live_exam_id = ? AND student_id = ? AND submitted_at IS NULL
  `).bind(
    JSON.stringify(params.answers || {}),
    timestamp,
    grading.score,
    grading.correctCount,
    wrongCount,
    timestamp,
    params.liveExamId,
    params.studentId,
  ).run();

  if (getChangedRows(result) !== 1) {
    const racedParticipant = await loadParticipantState(db, params.liveExamId, params.studentId);
    if (racedParticipant?.submitted_at) return replayCommittedSubmission(db, params);
    throw new LiveExamServiceError('Answers already submitted', 409);
  }

  return {
    score: grading.score,
    correctCount: grading.correctCount,
    wrongCount,
    submittedAt: timestamp,
  };
}
