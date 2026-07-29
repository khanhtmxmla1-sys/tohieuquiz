import type { D1Database } from '@cloudflare/workers-types';
import type { LiveExamSession } from '../../../../src/types/liveExam.types';
import { LiveExamServiceError } from './errors';

export interface ParticipantDeadlineRow {
  id: string;
  submitted_at: string | null;
  individual_ends_at: string | null;
}

export function getEffectiveParticipantEndsAt(
  sessionEndsAt: string | undefined,
  individualEndsAt: string | null | undefined,
): string | undefined {
  return individualEndsAt || sessionEndsAt;
}

export async function loadParticipantDeadline(
  db: D1Database,
  liveExamId: string,
  studentId: string,
): Promise<ParticipantDeadlineRow | null> {
  return db.prepare(`
    SELECT id, submitted_at, individual_ends_at
    FROM live_exam_participants
    WHERE live_exam_id = ? AND student_id = ?
  `).bind(liveExamId, studentId).first<ParticipantDeadlineRow>();
}

export async function requireParticipantWorkWindow(
  db: D1Database,
  session: LiveExamSession,
  studentId: string,
): Promise<ParticipantDeadlineRow> {
  const participant = await loadParticipantDeadline(db, session.id, studentId);
  if (!participant) throw new LiveExamServiceError('Forbidden: Join session first', 403);
  if (participant.submitted_at) throw new LiveExamServiceError('Answers already submitted', 409);
  if (session.status === 'paused') throw new LiveExamServiceError('Exam is paused', 409);
  if (session.status !== 'active') throw new LiveExamServiceError('Exam is not active', 409);

  const effectiveEndsAt = getEffectiveParticipantEndsAt(session.endsAt, participant.individual_ends_at);
  if (!effectiveEndsAt || Date.parse(effectiveEndsAt) <= Date.now()) {
    throw new LiveExamServiceError('Exam time has ended', 409);
  }
  return participant;
}
