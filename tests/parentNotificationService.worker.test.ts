// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createParentNotification,
  fanOutParentNotificationToClass,
} from '../workers/src/parentPortal/notificationService';
import { createDueHomeworkReminders } from '../workers/src/parentPortal/deadlineReminderService';

class FakeStatement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: FakeDb) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async run() { return this.db.run(this.sql, this.bindings); }
  async all<T>() { return { results: this.db.all(this.sql, this.bindings) as T[] }; }
}

class FakeDb {
  keys = new Set<string>();
  saved: Array<{ bindings: unknown[]; payload: Record<string, unknown> }> = [];
  students = [{ id: 'student-1' }, { id: 'student-2' }];
  dueRows: Array<Record<string, unknown>> = [];

  prepare(sql: string) { return new FakeStatement(sql, this); }

  all(sql: string, _bindings: unknown[]) {
    if (sql.includes('FROM hw_assignments ha')) return this.dueRows;
    if (sql.includes('FROM students')) return this.students;
    return [];
  }

  run(sql: string, bindings: unknown[]) {
    if (!sql.includes('INSERT OR IGNORE INTO parent_notifications')) {
      return { success: true, meta: { changes: 1 } };
    }
    const key = `${bindings[1]}:${bindings[3]}:${bindings[4]}`;
    const created = !this.keys.has(key);
    if (created) {
      this.keys.add(key);
      this.saved.push({
        bindings,
        payload: JSON.parse(String(bindings[7] || '{}')) as Record<string, unknown>,
      });
    }
    return { success: true, meta: { changes: created ? 1 : 0 } };
  }
}

const input = {
  studentId: 'student-1',
  kind: 'quiz_result' as const,
  sourceType: 'result',
  sourceId: 'result-1',
  title: 'Có kết quả mới',
  body: 'Bài Toán: 8/10',
  payload: {
    resultId: 'result-1',
    answers: { q1: 'A' },
    nested: { correct_answer: 'B', safe: true },
  },
  publishedAt: '2026-07-22T00:00:00.000Z',
};

describe('parent notification service', () => {
  it('is idempotent by student and source and strips answer data', async () => {
    const db = new FakeDb();
    const first = await createParentNotification(db as any, input);
    const second = await createParentNotification(db as any, input);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(db.saved).toHaveLength(1);
    expect(JSON.stringify(db.saved[0].payload)).not.toContain('answers');
    expect(JSON.stringify(db.saved[0].payload)).not.toContain('correct_answer');
    expect(db.saved[0].payload).toMatchObject({ resultId: 'result-1', nested: { safe: true } });
  });

  it('caps text lengths and fans out to every active student', async () => {
    const db = new FakeDb();
    const result = await fanOutParentNotificationToClass(db as any, {
      classId: 'class-1',
      kind: 'homework_assigned',
      sourceType: 'homework',
      sourceId: 'hw-1:published',
      title: 'T'.repeat(200),
      body: 'B'.repeat(2500),
      payload: { assignmentId: 'hw-1' },
      publishedAt: '2026-07-22T00:00:00.000Z',
    });

    expect(result).toEqual({ targetCount: 2, createdCount: 2 });
    expect(String(db.saved[0].bindings[5])).toHaveLength(160);
    expect(String(db.saved[0].bindings[6])).toHaveLength(2000);
  });

  it('creates one due reminder per unsubmitted student using a local-date source id', async () => {
    const db = new FakeDb();
    db.dueRows = [{
      assignment_id: 'hw-1',
      student_id: 'student-1',
      title: 'Bài tập Toán',
      subject: 'Toán',
      deadline: '2026-07-22T16:30:00.000Z',
    }];

    const result = await createDueHomeworkReminders(
      db as any,
      new Date('2026-07-22T00:00:00.000Z'),
    );

    expect(result).toEqual({ targetCount: 1, createdCount: 1 });
    expect(db.saved[0].bindings[3]).toBe('homework_due');
    expect(db.saved[0].bindings[4]).toBe('hw-1:2026-07-22');
  });
});
