import type { D1Database } from '@cloudflare/workers-types';
import { calculateStudentScore } from '../../../../src/features/quiz-player/utils/quizScoring';
import { LiveExamServiceError } from './errors';
import { getParticipants } from './participantService';
import { loadLiveExamQuiz } from './quizLoader';
import { getLiveExamById } from './sessionRepository';
import { now } from './utils';

const snapshotAnswersSql = `
  SELECT snapshots.answers
  FROM live_exam_answer_snapshots snapshots
  WHERE snapshots.live_exam_id = live_exam_participants.live_exam_id
    AND snapshots.student_id = live_exam_participants.student_id
`;

export async function autoSubmitIncompleteAnswers(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  const timestamp = now();
  await db.prepare(`
    UPDATE live_exam_participants
    SET answers = COALESCE(answers, (${snapshotAnswersSql}), '{}'),
        submitted_at = ?, updated_at = ?
    WHERE live_exam_id = ? AND submitted_at IS NULL
  `).bind(timestamp, timestamp, sessionId).run();
}

async function autoSubmitExpiredParticipants(db: D1Database, timestamp: string): Promise<void> {
  await db.prepare(`
    UPDATE live_exam_participants
    SET answers = COALESCE(answers, (${snapshotAnswersSql}), '{}'),
        submitted_at = ?, updated_at = ?
    WHERE submitted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM live_exam_sessions sessions
        WHERE sessions.id = live_exam_participants.live_exam_id
          AND sessions.status = 'active'
          AND sessions.archived_at IS NULL
          AND COALESCE(live_exam_participants.individual_ends_at, sessions.ends_at) <= ?
      )
  `).bind(timestamp, timestamp, timestamp).run();
}

export async function calculateScoresAndClose(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  const session = await getLiveExamById(db, sessionId);
  if (!session) throw new LiveExamServiceError('Session not found', 404);
  const quiz = await loadLiveExamQuiz(db, session);
  const participants = await getParticipants(db, sessionId);

  const scoredParticipants = participants.map((participant) => {
    const grading = calculateStudentScore(quiz, participant.answers || {});
    return {
      ...participant,
      score: grading.score,
      correctCount: grading.correctCount,
      wrongCount: Math.max(0, grading.totalItems - grading.correctCount),
    };
  });

  scoredParticipants.sort((a, b) => {
    const scoreDifference = Number(b.score || 0) - Number(a.score || 0);
    if (scoreDifference !== 0) return scoreDifference;
    return Date.parse(a.submittedAt || a.joinedAt) - Date.parse(b.submittedAt || b.joinedAt);
  });

  let previousScore: number | null = null;
  let previousRank = 0;
  scoredParticipants.forEach((participant, index) => {
    const currentScore = Number(participant.score || 0);
    participant.rank = previousScore !== null && currentScore === previousScore
      ? previousRank
      : index + 1;
    previousScore = currentScore;
    previousRank = participant.rank;
  });

  for (const participant of scoredParticipants) {
    await db.prepare(`
      UPDATE live_exam_participants
      SET score = ?, correct_count = ?, wrong_count = ?, rank = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      participant.score,
      participant.correctCount,
      participant.wrongCount,
      participant.rank,
      now(),
      participant.id,
    ).run();
  }

  await db.prepare(`
    UPDATE live_exam_sessions
    SET status = 'closed', closed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(now(), now(), sessionId).run();
}

export async function checkAndAutoCloseExpiredExams(db: D1Database): Promise<void> {
  const timestamp = now();
  await autoSubmitExpiredParticipants(db, timestamp);
  const expiredSessions = await db.prepare(`
    SELECT sessions.id FROM live_exam_sessions sessions
    WHERE sessions.status = 'active'
      AND sessions.archived_at IS NULL
      AND sessions.ends_at <= ?
      AND NOT EXISTS (
        SELECT 1 FROM live_exam_participants participants
        WHERE participants.live_exam_id = sessions.id
          AND participants.submitted_at IS NULL
          AND COALESCE(participants.individual_ends_at, sessions.ends_at) > ?
      )
  `).bind(timestamp, timestamp).all();

  for (const session of expiredSessions.results) {
    const sessionId = session.id as string;
    await autoSubmitIncompleteAnswers(db, sessionId);
    await db.prepare(`
      UPDATE live_exam_sessions
      SET status = 'scoring', updated_at = ?
      WHERE id = ?
    `).bind(now(), sessionId).run();
    await calculateScoresAndClose(db, sessionId);
  }
}
