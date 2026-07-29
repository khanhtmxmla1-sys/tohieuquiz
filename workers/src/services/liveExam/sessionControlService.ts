import type { D1Database } from '@cloudflare/workers-types';
import { LiveExamServiceError } from './errors';
import { autoSubmitIncompleteAnswers, calculateScoresAndClose } from './scoringService';
import { getLiveExamById } from './sessionRepository';
import { calculateEndTime, getChangedRows, now } from './utils';

const END_EARLY_CONFIRMATION_TTL_MS = 2 * 60 * 1000;

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

const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const recordControlAudit = async (
  db: D1Database,
  sessionId: string,
  actorUsername: string,
  action: string,
  requestId: string,
  options: { targetParticipantId?: string; metadata?: Record<string, unknown> } = {},
): Promise<void> => {
  await db.prepare(`
    INSERT INTO live_exam_control_audit (
      id, live_exam_id, actor_username, action,
      target_participant_id, request_id, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    sessionId,
    actorUsername,
    action,
    options.targetParticipantId || null,
    requestId,
    JSON.stringify(options.metadata || {}),
    now(),
  ).run();
};

export async function openSession(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
  requestId: string = crypto.randomUUID(),
): Promise<void> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (session.status !== 'scheduled') {
    throw new LiveExamServiceError(`Cannot open session in status: ${session.status}`, 409);
  }
  await db.prepare(`
    UPDATE live_exam_sessions SET status = 'waiting', updated_at = ? WHERE id = ?
  `).bind(now(), sessionId).run();
  await recordControlAudit(db, sessionId, teacherId, 'open_session', requestId);
}

export async function startExam(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
  requestId: string = crypto.randomUUID(),
): Promise<void> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (session.status !== 'waiting') {
    throw new LiveExamServiceError(`Cannot start exam in status: ${session.status}`, 409);
  }
  const startedAt = now();
  await db.prepare(`
    UPDATE live_exam_sessions
    SET status = 'active', started_at = ?, ends_at = ?, paused_at = NULL, updated_at = ?
    WHERE id = ?
  `).bind(startedAt, calculateEndTime(startedAt, session.duration), now(), sessionId).run();
  await recordControlAudit(db, sessionId, teacherId, 'start_exam', requestId);
}

export async function pauseExam(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
  requestId: string = crypto.randomUUID(),
): Promise<void> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (session.status !== 'active') {
    throw new LiveExamServiceError(`Cannot pause exam in status: ${session.status}`, 409);
  }
  const pausedAt = now();
  await db.prepare(`
    UPDATE live_exam_sessions
    SET status = 'paused', paused_at = ?, updated_at = ?
    WHERE id = ? AND status = 'active'
  `).bind(pausedAt, pausedAt, sessionId).run();
  await recordControlAudit(db, sessionId, teacherId, 'pause_exam', requestId, {
    metadata: { pausedAt },
  });
}

export async function resumeExam(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
  requestId: string = crypto.randomUUID(),
): Promise<void> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (session.status !== 'paused' || !session.pausedAt || !session.endsAt) {
    throw new LiveExamServiceError(`Cannot resume exam in status: ${session.status}`, 409);
  }
  const resumedAt = now();
  const pauseSeconds = Math.max(0, Math.ceil((Date.parse(resumedAt) - Date.parse(session.pausedAt)) / 1000));
  const shiftedEndsAt = new Date(Date.parse(session.endsAt) + pauseSeconds * 1000).toISOString();
  await db.batch([
    db.prepare(`
      UPDATE live_exam_sessions
      SET status = 'active', ends_at = ?, paused_at = NULL,
          total_paused_seconds = COALESCE(total_paused_seconds, 0) + ?, updated_at = ?
      WHERE id = ? AND status = 'paused'
    `).bind(shiftedEndsAt, pauseSeconds, resumedAt, sessionId),
    db.prepare(`
      UPDATE live_exam_participants
      SET individual_ends_at = strftime('%Y-%m-%dT%H:%M:%fZ', individual_ends_at, '+' || ? || ' seconds'), updated_at = ?
      WHERE live_exam_id = ? AND individual_ends_at IS NOT NULL AND submitted_at IS NULL
    `).bind(pauseSeconds, resumedAt, sessionId),
  ]);
  await recordControlAudit(db, sessionId, teacherId, 'resume_exam', requestId, {
    metadata: { resumedAt, pauseSeconds, shiftedEndsAt },
  });
}

export async function extendParticipantTime(
  db: D1Database,
  sessionId: string,
  participantId: string,
  extraMinutes: number,
  teacherId: string,
  isAdmin = false,
  requestId: string = crypto.randomUUID(),
): Promise<string> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (!['active', 'paused'].includes(session.status) || !session.endsAt) {
    throw new LiveExamServiceError(`Cannot extend participant in status: ${session.status}`, 409);
  }
  const participant = await db.prepare(`
    SELECT id, submitted_at, individual_ends_at
    FROM live_exam_participants
    WHERE id = ? AND live_exam_id = ?
  `).bind(participantId, sessionId).first<{
    id: string;
    submitted_at: string | null;
    individual_ends_at: string | null;
  }>();
  if (!participant) throw new LiveExamServiceError('Participant not found', 404);
  if (participant.submitted_at) throw new LiveExamServiceError('Participant already submitted', 409);

  const referenceTime = session.status === 'paused' && session.pausedAt
    ? Date.parse(session.pausedAt)
    : Date.now();
  const currentDeadline = Date.parse(participant.individual_ends_at || session.endsAt);
  const extendedEndsAt = new Date(Math.max(referenceTime, currentDeadline) + extraMinutes * 60_000).toISOString();
  await db.prepare(`
    UPDATE live_exam_participants
    SET individual_ends_at = ?, updated_at = ?
    WHERE id = ? AND live_exam_id = ? AND submitted_at IS NULL
  `).bind(extendedEndsAt, now(), participantId, sessionId).run();
  await recordControlAudit(db, sessionId, teacherId, 'extend_participant', requestId, {
    targetParticipantId: participantId,
    metadata: { extraMinutes, extendedEndsAt },
  });
  return extendedEndsAt;
}

export async function prepareEndExamEarly(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  isAdmin = false,
  requestId: string = crypto.randomUUID(),
): Promise<{ confirmationToken: string; expiresAt: string }> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (!['active', 'paused'].includes(session.status)) {
    throw new LiveExamServiceError(`Cannot end exam in status: ${session.status}`, 409);
  }
  const confirmationToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
  const tokenHash = await hashToken(confirmationToken);
  const createdAt = now();
  const expiresAt = new Date(Date.parse(createdAt) + END_EARLY_CONFIRMATION_TTL_MS).toISOString();
  await db.prepare(`
    INSERT INTO live_exam_control_confirmations (
      id, live_exam_id, actor_username, action, token_hash, expires_at, created_at
    ) VALUES (?, ?, ?, 'end_early', ?, ?, ?)
  `).bind(crypto.randomUUID(), sessionId, teacherId, tokenHash, expiresAt, createdAt).run();
  await recordControlAudit(db, sessionId, teacherId, 'prepare_end_early', requestId, {
    metadata: { expiresAt },
  });
  return { confirmationToken, expiresAt };
}

export async function endExamEarly(
  db: D1Database,
  sessionId: string,
  teacherId: string,
  confirmationToken: string,
  reason: string,
  isAdmin = false,
  requestId: string = crypto.randomUUID(),
): Promise<void> {
  const session = await requireControllableSession(db, sessionId, teacherId, isAdmin);
  if (!['active', 'paused'].includes(session.status)) {
    throw new LiveExamServiceError(`Cannot end exam in status: ${session.status}`, 409);
  }
  const timestamp = now();
  const tokenHash = await hashToken(confirmationToken);
  const consumed = await db.prepare(`
    UPDATE live_exam_control_confirmations
    SET consumed_at = ?
    WHERE live_exam_id = ? AND actor_username = ? AND action = 'end_early'
      AND token_hash = ? AND consumed_at IS NULL AND expires_at > ?
  `).bind(timestamp, sessionId, teacherId, tokenHash, timestamp).run();
  if (getChangedRows(consumed) !== 1) {
    throw new LiveExamServiceError('Early-end confirmation is invalid or expired', 409);
  }

  await autoSubmitIncompleteAnswers(db, sessionId);
  await db.prepare(`
    UPDATE live_exam_sessions SET status = 'scoring', paused_at = NULL, updated_at = ? WHERE id = ?
  `).bind(timestamp, sessionId).run();
  await recordControlAudit(db, sessionId, teacherId, 'end_early_confirmed', requestId, {
    metadata: { reason },
  });
  await calculateScoresAndClose(db, sessionId);
  await recordControlAudit(db, sessionId, teacherId, 'end_early_completed', requestId, {
    metadata: { reason },
  });
}
