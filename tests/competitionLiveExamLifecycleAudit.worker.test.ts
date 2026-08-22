// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { createSqliteD1 } from './helpers/sqliteD1';

let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe('Competition Live Exam lifecycle audit adapter', () => {
  it('writes lifecycle events only for SCHOOL_EXAM_ROOM sessions', async () => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE competition_school_exam_rooms (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        live_exam_session_id TEXT NOT NULL
      );
      CREATE TABLE admin_audit_logs (
        id TEXT PRIMARY KEY,
        actor_username TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO competition_school_exam_rooms (id, event_id, live_exam_session_id)
      VALUES ('room-1', 'event-1', 'school-session-1');
    `);

    const { auditCompetitionExamLifecycle } = await import('../workers/src/competition/liveExamLifecycleAudit');
    await auditCompetitionExamLifecycle(
      createSqliteD1(db) as any,
      'school-session-1',
      'EXAM_STARTED',
      'teacher-4',
      'start-school-0001',
      { roomId: 'room-1' },
    );
    await auditCompetitionExamLifecycle(
      createSqliteD1(db) as any,
      'class-session-1',
      'EXAM_CLOSED',
      'system',
      'close-class-0001',
      {},
    );

    expect(db.prepare(`
      SELECT action, target_type, target_id, request_id, after_json
      FROM admin_audit_logs
    `).all()).toEqual([
      {
        action: 'EXAM_STARTED',
        target_type: 'competition_school_exam_event',
        target_id: 'event-1',
        request_id: 'start-school-0001',
        after_json: JSON.stringify({ roomId: 'room-1', sessionId: 'school-session-1' }),
      },
    ]);
  });
});
