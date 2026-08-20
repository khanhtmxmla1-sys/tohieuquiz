import type { D1Database } from '@cloudflare/workers-types';
import { QUIZ_SCORING_ENGINE_VERSION, gradeQuiz } from '../../../../src/domain/quiz-scoring';
import { getEffectiveParticipantEndsAt } from './deadlineService';
import { LiveExamServiceError } from './errors';
import { loadLiveExamQuiz } from './quizLoader';
import type { SubmissionScoreSummary, SubmitAnswersParams } from './types';
import { getChangedRows, mapSessionRow, now } from './utils';

interface ParticipantSubmissionRow {
  id: string;
  submitted_at: string | null;
  individual_ends_at: string | null;
}

interface CommittedSubmissionRow {
  answers: string | null;
  score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  submitted_at: string | null;
}

interface SubmissionContextRow {
  participant_id: string | null;
  participant_submitted_at: string | null;
  participant_individual_ends_at: string | null;
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

const loadSubmissionContext = async (
  db: D1Database,
  liveExamId: string,
  studentId: string,
) => {
  const row = await db.prepare(`
    SELECT
      sessions.*,
      quizzes.title AS quiz_title,
      classes.name AS class_name,
      participants.id AS participant_id,
      participants.submitted_at AS participant_submitted_at,
      participants.individual_ends_at AS participant_individual_ends_at
    FROM live_exam_sessions sessions
    LEFT JOIN quizzes ON quizzes.id = sessions.quiz_id
    LEFT JOIN classes ON classes.id = sessions.class_id
    LEFT JOIN live_exam_participants participants
      ON participants.live_exam_id = sessions.id
     AND participants.student_id = ?
    WHERE sessions.id = ?
  `).bind(studentId, liveExamId).first<SubmissionContextRow & Record<string, unknown>>();
  if (!row) return null;

  return {
    session: mapSessionRow(row),
    participant: row.participant_id ? {
      id: String(row.participant_id),
      submitted_at: row.participant_submitted_at || null,
      individual_ends_at: row.participant_individual_ends_at || null,
    } satisfies ParticipantSubmissionRow : null,
  };
};

const loadParticipantState = async (
  db: D1Database,
  liveExamId: string,
  studentId: string,
): Promise<ParticipantSubmissionRow | null> => db.prepare(`
    SELECT id, submitted_at, individual_ends_at FROM live_exam_participants
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
  const context = await loadSubmissionContext(db, params.liveExamId, params.studentId);
  if (!context || context.session.archivedAt) throw new LiveExamServiceError('Session not found', 404);

  const { session, participant } = context;
  if (participant?.submitted_at) return replayCommittedSubmission(db, params);

  if (session.status === 'paused') throw new LiveExamServiceError('Exam is paused', 409);
  if (session.status !== 'active') throw new LiveExamServiceError('Exam is not active', 409);
  const effectiveEndsAt = getEffectiveParticipantEndsAt(session.endsAt, participant?.individual_ends_at);
  if (!effectiveEndsAt || Date.parse(effectiveEndsAt) <= Date.now()) {
    throw new LiveExamServiceError('Exam time has ended', 409);
  }
  if (!participant) throw new LiveExamServiceError('Forbidden: Join session first', 403);

  const quiz = await loadLiveExamQuiz(db, session);
  const grading = gradeQuiz(quiz, params.answers || {});
  const wrongCount = Math.max(0, grading.totalQuestions - grading.correctCount);
  const result = await db.prepare(`
    UPDATE live_exam_participants
    SET answers = ?, submitted_at = ?, score = ?, correct_count = ?, wrong_count = ?, grading_version = ?, updated_at = ?
    WHERE live_exam_id = ? AND student_id = ? AND submitted_at IS NULL
  `).bind(
    JSON.stringify(params.answers || {}),
    timestamp,
    grading.score,
    grading.correctCount,
    wrongCount,
    QUIZ_SCORING_ENGINE_VERSION,
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
