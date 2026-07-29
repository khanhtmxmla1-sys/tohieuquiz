import type { D1Database } from '@cloudflare/workers-types';
import { requireParticipantWorkWindow } from './deadlineService';
import { LiveExamServiceError } from './errors';
import { getLiveExamById } from './sessionRepository';
import { now } from './utils';
import type { StudentAnswers } from '../../../../src/types/liveExam.types';

export interface SaveAnswerSnapshotParams {
  liveExamId: string;
  studentId: string;
  attemptVersion: number;
  idempotencyKey: string;
  answers: StudentAnswers;
}

export interface AnswerSnapshot {
  attemptVersion: number;
  answers: StudentAnswers;
  updatedAt: string;
}

interface SnapshotRow {
  attempt_version: number;
  idempotency_key: string;
  answers: string;
  updated_at: string;
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
};

const serializeAnswers = (answers: StudentAnswers): string => JSON.stringify(canonicalize(answers));

const assertActiveParticipant = async (db: D1Database, liveExamId: string, studentId: string) => {
  const session = await getLiveExamById(db, liveExamId);
  if (!session || session.archivedAt) throw new LiveExamServiceError('Session not found', 404);
  await requireParticipantWorkWindow(db, session, studentId);
};

export async function getAnswerSnapshot(
  db: D1Database,
  liveExamId: string,
  studentId: string,
): Promise<AnswerSnapshot | null> {
  const row = await db.prepare(`
    SELECT attempt_version, answers, updated_at
    FROM live_exam_answer_snapshots
    WHERE live_exam_id = ? AND student_id = ?
  `).bind(liveExamId, studentId).first<SnapshotRow>();
  if (!row) return null;
  return {
    attemptVersion: Number(row.attempt_version),
    answers: JSON.parse(row.answers || '{}') as StudentAnswers,
    updatedAt: row.updated_at,
  };
}

export async function saveAnswerSnapshot(
  db: D1Database,
  params: SaveAnswerSnapshotParams,
): Promise<AnswerSnapshot> {
  await assertActiveParticipant(db, params.liveExamId, params.studentId);
  const timestamp = now();
  const serialized = serializeAnswers(params.answers);
  const existing = await db.prepare(`
    SELECT attempt_version, idempotency_key, answers, updated_at
    FROM live_exam_answer_snapshots
    WHERE live_exam_id = ? AND student_id = ?
  `).bind(params.liveExamId, params.studentId).first<SnapshotRow>();

  if (existing) {
    if (existing.idempotency_key === params.idempotencyKey) {
      if (existing.answers !== serialized || Number(existing.attempt_version) !== params.attemptVersion) {
        throw new LiveExamServiceError('Idempotency key reused with different snapshot', 409);
      }
      return { attemptVersion: Number(existing.attempt_version), answers: params.answers, updatedAt: existing.updated_at };
    }
    if (params.attemptVersion <= Number(existing.attempt_version)) {
      throw new LiveExamServiceError('Stale answer snapshot version', 409);
    }
  }

  await db.prepare(`
    INSERT INTO live_exam_answer_snapshots (
      live_exam_id, student_id, attempt_version, answers, idempotency_key, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(live_exam_id, student_id) DO UPDATE SET
      attempt_version = excluded.attempt_version,
      answers = excluded.answers,
      idempotency_key = excluded.idempotency_key,
      updated_at = excluded.updated_at
  `).bind(
    params.liveExamId,
    params.studentId,
    params.attemptVersion,
    serialized,
    params.idempotencyKey,
    timestamp,
  ).run();

  await db.prepare(`
    INSERT INTO live_exam_connection_events (
      id, live_exam_id, student_id, event_type, attempt_version, created_at
    ) VALUES (?, ?, ?, 'autosave', ?, ?)
  `).bind(crypto.randomUUID(), params.liveExamId, params.studentId, params.attemptVersion, timestamp).run();

  return { attemptVersion: params.attemptVersion, answers: params.answers, updatedAt: timestamp };
}

export async function recordConnectionEvent(
  db: D1Database,
  liveExamId: string,
  studentId: string,
  eventType: 'online' | 'reconnecting' | 'offline' | 'reconnected',
): Promise<void> {
  await db.prepare(`
    INSERT INTO live_exam_connection_events (
      id, live_exam_id, student_id, event_type, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), liveExamId, studentId, eventType, now()).run();
}
