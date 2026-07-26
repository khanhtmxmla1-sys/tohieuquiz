import type { D1Database } from '@cloudflare/workers-types';
import { LiveExamServiceError } from './errors';
import { getLiveExamById } from './sessionRepository';
import type { UpdateActivityParams } from './types';
import { now } from './utils';

export async function updateActivity(
  db: D1Database,
  params: UpdateActivityParams,
): Promise<void> {
  const timestamp = now();
  const session = await getLiveExamById(db, params.liveExamId);
  if (!session || session.archivedAt) throw new LiveExamServiceError('Session not found', 404);
  if (session.status !== 'active' || !session.endsAt || Date.parse(session.endsAt) <= Date.now()) {
    throw new LiveExamServiceError('Exam is not active', 409);
  }

  const participant = await db.prepare(
    'SELECT submitted_at FROM live_exam_participants WHERE live_exam_id = ? AND student_id = ?',
  ).bind(params.liveExamId, params.studentId).first<{ submitted_at: string | null }>();
  if (!participant) throw new LiveExamServiceError('Forbidden: Join session first', 403);
  if (participant.submitted_at) throw new LiveExamServiceError('Answers already submitted', 409);

  await db.prepare(`
    INSERT INTO live_exam_activity (
      live_exam_id, student_id, current_question,
      answered_count, last_activity, is_online
    ) VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(live_exam_id, student_id) DO UPDATE SET
      current_question = excluded.current_question,
      answered_count = excluded.answered_count,
      last_activity = excluded.last_activity,
      is_online = 1
  `).bind(
    params.liveExamId,
    params.studentId,
    params.currentQuestion || null,
    params.answeredCount,
    timestamp,
  ).run();
}

export async function markInactiveParticipants(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
  await db.prepare(`
    UPDATE live_exam_activity
    SET is_online = 0
    WHERE live_exam_id = ? AND last_activity < ?
  `).bind(sessionId, tenSecondsAgo).run();
}
