import { describe, expect, it } from 'vitest';
import { saveAnswerSnapshot } from '../workers/src/services/liveExam/connectionEventService';
import { LiveExamServiceError } from '../workers/src/services/liveExam/errors';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.first(this.sql) as T | null; }
  async run() { return this.db.run(this.sql, this.bindings); }
}
class Database {
  snapshot: any = null;
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string) {
    if (sql.includes('FROM live_exam_sessions s')) return {
      id: 'live-1', title: 'Exam', quiz_id: 'quiz-1', quiz_title: 'Quiz', teacher_id: 'teacher-1',
      class_id: 'class-1', class_name: 'Class', duration: 30, scheduled_at: null,
      started_at: '2026-07-28T00:00:00.000Z', ends_at: '2099-07-28T00:30:00.000Z', closed_at: null,
      settings: '{}', status: 'active', access_code: 'ABC123', chat_enabled: 1, archived_at: null,
      created_at: '2026-07-28T00:00:00.000Z', updated_at: '2026-07-28T00:00:00.000Z',
    };
    if (sql.includes('SELECT id, submitted_at, individual_ends_at')) return { id: 'participant-1', submitted_at: null, individual_ends_at: null };
    if (sql.includes('FROM live_exam_answer_snapshots')) return this.snapshot;
    return null;
  }
  run(sql: string, bindings: unknown[]) {
    if (sql.includes('INSERT INTO live_exam_answer_snapshots')) {
      this.snapshot = { attempt_version: bindings[2], answers: bindings[3], idempotency_key: bindings[4], updated_at: bindings[5] };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

describe('Live Exam reconnect autosave', () => {
  it('accepts increasing versions and replays the same idempotency key', async () => {
    const db = new Database();
    const params = { liveExamId: 'live-1', studentId: 'student-1', attemptVersion: 1, idempotencyKey: 'autosave:live-1:1:abcdef', answers: { q1: 'B' } };
    await expect(saveAnswerSnapshot(db as any, params)).resolves.toMatchObject({ attemptVersion: 1 });
    await expect(saveAnswerSnapshot(db as any, params)).resolves.toMatchObject({ attemptVersion: 1 });
  });

  it('rejects stale versions without replacing server state', async () => {
    const db = new Database();
    db.snapshot = { attempt_version: 2, idempotency_key: 'autosave:2', answers: JSON.stringify({ q1: 'B' }), updated_at: '2026-07-28T00:00:00.000Z' };
    await expect(saveAnswerSnapshot(db as any, {
      liveExamId: 'live-1', studentId: 'student-1', attemptVersion: 1,
      idempotencyKey: 'autosave:1', answers: { q1: 'A' },
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(LiveExamServiceError);
      expect((error as LiveExamServiceError).status).toBe(409);
      return true;
    });
  });
});
