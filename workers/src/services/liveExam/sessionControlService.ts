import type { D1Database } from '@cloudflare/workers-types';
import { LiveExamServiceError } from './errors';
import { autoSubmitIncompleteAnswers, calculateScoresAndClose } from './scoringService';
import { getLiveExamById } from './sessionRepository';
import { calculateEndTime, now } from './utils';

async function requireControllableSession(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin: boolean,
) {
  const session = await getLiveExamById(db, sessionId);
  if (!session) throw new LiveExamServiceError('Session not found', 404);
  if (!isAdmin && session.teacherId !== teacherId) {
    throw new LiveExamServiceError('Forbidden: You do not own this session', 403);
  }
  if (session.archivedAt) throw new LiveExamServiceError('Session is archived', 409);
  return session;
}

export async function openSession(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
): Promise<void> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (session.status !== 'scheduled') {
    throw new LiveExamServiceError(`Cannot open session in status: ${session.status}`, 409);
  }
  await db.prepare(`
    UPDATE live_exam_sessions SET status = 'waiting', updated_at = ? WHERE id = ?
  `).bind(now(), sessionId).run();
}

export async function startExam(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
): Promise<void> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (session.status !== 'waiting') {
    throw new LiveExamServiceError(`Cannot start exam in status: ${session.status}`, 409);
  }
  const startedAt = now();
  await db.prepare(`
    UPDATE live_exam_sessions
    SET status = 'active', started_at = ?, ends_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(startedAt, calculateEndTime(startedAt, session.duration), now(), sessionId).run();
}

export async function endExamEarly(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
): Promise<void> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (session.status !== 'active') {
    throw new LiveExamServiceError(`Cannot end exam in status: ${session.status}`, 409);
  }
  await autoSubmitIncompleteAnswers(db, sessionId);
  await db.prepare(`
    UPDATE live_exam_sessions SET status = 'scoring', updated_at = ? WHERE id = ?
  `).bind(now(), sessionId).run();
  await calculateScoresAndClose(db, sessionId);
}
