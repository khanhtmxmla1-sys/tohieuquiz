import type { D1Database } from '@cloudflare/workers-types';
import { calculateStudentScore } from '../../../../src/features/quiz-player/utils/quizScoring';
import { LiveExamServiceError } from './errors';
import { loadLiveExamQuiz } from './quizLoader';
import { getLiveExamById } from './sessionRepository';
import type { SubmissionScoreSummary, SubmitAnswersParams } from './types';
import { getChangedRows, now } from './utils';

export async function submitAnswers(
  db: D1Database,
  params: SubmitAnswersParams,
): Promise<SubmissionScoreSummary> {
  const timestamp = now();
  const session = await getLiveExamById(db, params.liveExamId);
  if (!session || session.archivedAt) throw new LiveExamServiceError('Session not found', 404);
  if (session.status !== 'active') throw new LiveExamServiceError('Exam is not active', 409);
  if (!session.endsAt || Date.parse(session.endsAt) <= Date.now()) {
    throw new LiveExamServiceError('Exam time has ended', 409);
  }

  const participant = await db.prepare(`
    SELECT id, submitted_at FROM live_exam_participants
    WHERE live_exam_id = ? AND student_id = ?
  `).bind(params.liveExamId, params.studentId).first<{ id: string; submitted_at: string | null }>();
  if (!participant) throw new LiveExamServiceError('Forbidden: Join session first', 403);
  if (participant.submitted_at) throw new LiveExamServiceError('Answers already submitted', 409);

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
    throw new LiveExamServiceError('Answers already submitted', 409);
  }

  return {
    score: grading.score,
    correctCount: grading.correctCount,
    wrongCount,
    submittedAt: timestamp,
  };
}
