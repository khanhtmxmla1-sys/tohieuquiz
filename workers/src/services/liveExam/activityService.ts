import type { D1Database } from '@cloudflare/workers-types';
import { requireParticipantWorkWindow } from './deadlineService';
import { LiveExamServiceError } from './errors';
import { getLiveExamById } from './sessionRepository';
import type { UpdateActivityParams } from './types';
import { now } from './utils';

export async function updateActivity(
  db: D1Database,
  params: UpdateActivityParams,
): Promise<void> {
  const timestamp = now();
  const throttleCutoff = new Date(Date.now() - 5_000).toISOString();
  const session = await getLiveExamById(db, params.liveExamId);
  if (!session || session.archivedAt) throw new LiveExamServiceError('Session not found', 404);
  await requireParticipantWorkWindow(db, session, params.studentId);

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
    WHERE live_exam_activity.last_activity <= ?
  `).bind(
    params.liveExamId,
    params.studentId,
    params.currentQuestion || null,
    params.answeredCount,
    timestamp,
    throttleCutoff,
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
