import { auditStatement } from '../utils/audit';

export type CompetitionExamLifecycleAction = 'EXAM_STARTED' | 'EXAM_CLOSED';

export async function auditCompetitionExamLifecycle(
  db: D1Database,
  sessionId: string,
  action: CompetitionExamLifecycleAction,
  actorUsername: string,
  requestId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const room = await db.prepare(`
    SELECT id, event_id
    FROM competition_school_exam_rooms
    WHERE live_exam_session_id = ?
    LIMIT 1
  `).bind(sessionId).first<{ id: string; event_id: string }>();
  if (!room) return;

  await auditStatement(db, {
    actorUsername,
    action,
    targetType: 'competition_school_exam_event',
    targetId: room.event_id,
    requestId,
    after: { ...metadata, roomId: room.id, sessionId },
  }).run();
}
