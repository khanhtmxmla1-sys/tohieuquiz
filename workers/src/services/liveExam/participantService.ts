import type { D1Database } from '@cloudflare/workers-types';
import type { LiveExamParticipant } from '../../../../src/types/liveExam.types';
import { LiveExamServiceError } from './errors';
import { getLiveExamByAccessCode } from './sessionRepository';
import type { JoinSessionParams } from './types';
import { generateId, mapParticipantRow, now } from './utils';

export async function joinSession(
  db: D1Database,
  params: JoinSessionParams,
): Promise<LiveExamParticipant> {
  const session = await getLiveExamByAccessCode(db, params.accessCode);
  if (!session) throw new LiveExamServiceError('Invalid access code', 404);

  const mayJoinWaiting = session.status === 'waiting';
  const mayJoinActive = session.status === 'active' && session.settings.allowLateJoin;
  if (!mayJoinWaiting && !mayJoinActive) {
    if (session.status === 'active') throw new LiveExamServiceError('Late join not allowed', 409);
    throw new LiveExamServiceError(`Session is not open for joining (${session.status})`, 409);
  }

  const student = await db.prepare(`
    SELECT id, class_id FROM students
    WHERE id = ? AND archived_at IS NULL
  `).bind(params.studentId).first<{ id: string; class_id: string }>();
  if (!student) throw new LiveExamServiceError('Student not found or archived', 404);

  const participantScopeType = session.participantScopeType || 'CLASS';
  if (participantScopeType === 'CLASS') {
    if (!session.classId) throw new LiveExamServiceError('Session class is not configured', 409);
    if (student.class_id !== session.classId) {
      throw new LiveExamServiceError('Forbidden: Student is not in the assigned class', 403);
    }
  } else {
    if (!session.participantScopeId) {
      throw new LiveExamServiceError('School exam room scope is not configured', 409);
    }
    const roomMember = await db.prepare(`
      SELECT id, original_class_id
      FROM competition_school_exam_members
      WHERE room_id = ? AND student_id = ?
        AND status <> 'VOID'
      LIMIT 1
    `).bind(session.participantScopeId, params.studentId).first<{
      id: string;
      original_class_id: string;
    }>();
    if (!roomMember) {
      throw new LiveExamServiceError('Forbidden: Student is not assigned to this school exam room', 403);
    }
  }

  const existing = await db.prepare(`
    SELECT * FROM live_exam_participants
    WHERE live_exam_id = ? AND student_id = ?
  `).bind(session.id, params.studentId).first<any>();
  if (existing) return mapParticipantRow(existing);

  const id = generateId();
  const timestamp = now();
  await db.prepare(`
    INSERT INTO live_exam_participants (
      id, live_exam_id, student_id, username,
      joined_at, tab_switches, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(
    id,
    session.id,
    params.studentId,
    params.username,
    timestamp,
    timestamp,
    timestamp,
  ).run();

  return {
    id,
    liveExamId: session.id,
    studentId: params.studentId,
    username: params.username,
    joinedAt: timestamp,
    tabSwitches: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function getParticipants(
  db: D1Database,
  sessionId: string,
): Promise<LiveExamParticipant[]> {
  const rows = await db.prepare(`
    SELECT * FROM live_exam_participants
    WHERE live_exam_id = ?
    ORDER BY joined_at ASC
  `).bind(sessionId).all();
  return rows.results.map(mapParticipantRow);
}
