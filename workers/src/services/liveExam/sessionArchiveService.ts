import type { D1Database } from '@cloudflare/workers-types';
import { LiveExamServiceError } from './errors';
import { getLiveExamById } from './sessionRepository';
import { now } from './utils';

export async function deleteLiveExam(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
): Promise<void> {
  const session = await getLiveExamById(db, sessionId);
  if (!session) throw new LiveExamServiceError('Session not found', 404);
  if (!isAdmin && session.teacherId !== teacherId) {
    throw new LiveExamServiceError('Forbidden: You do not own this session', 403);
  }
  if (session.archivedAt) return;
  if (session.status === 'waiting' || session.status === 'active' || session.status === 'scoring') {
    throw new LiveExamServiceError(
      'Cannot archive a session that is waiting, active, or scoring',
      409,
    );
  }
  await db.prepare(`
    UPDATE live_exam_sessions
    SET archived_at = ?, updated_at = ?
    WHERE id = ? AND archived_at IS NULL
  `).bind(now(), now(), sessionId).run();
}
