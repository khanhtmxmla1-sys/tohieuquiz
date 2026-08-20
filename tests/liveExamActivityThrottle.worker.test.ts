import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateActivity } from '../workers/src/services/liveExam/activityService';

class Statement {
  private bindings: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly db: ActivityDb,
  ) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    return this.db.first(this.sql) as T | null;
  }

  async run() {
    this.db.runs.push({ sql: this.sql, bindings: this.bindings });
    return { success: true, meta: { changes: 1 } };
  }
}

class ActivityDb {
  runs: Array<{ sql: string; bindings: unknown[] }> = [];

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first(sql: string) {
    if (sql.includes('FROM live_exam_sessions s')) {
      return {
        id: 'live-1', title: 'Exam', quiz_id: 'quiz-1', quiz_title: 'Quiz', teacher_id: 'teacher-1',
        class_id: 'class-1', class_name: 'Class', duration: 30, scheduled_at: null,
        started_at: '2026-08-19T00:00:00.000Z', ends_at: '2099-08-19T00:30:00.000Z', closed_at: null,
        settings: '{}', status: 'active', access_code: 'ABC123', chat_enabled: 1, archived_at: null,
        created_at: '2026-08-19T00:00:00.000Z', updated_at: '2026-08-19T00:00:00.000Z',
      };
    }
    if (sql.includes('SELECT id, submitted_at, individual_ends_at')) {
      return { id: 'participant-1', submitted_at: null, individual_ends_at: null };
    }
    return null;
  }
}

describe('Live Exam activity write throttle', () => {
  afterEach(() => vi.useRealTimers());

  it('updates an existing activity row only when its heartbeat is at least 5 seconds old', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-19T00:10:00.000Z');
    const db = new ActivityDb();

    await updateActivity(db as any, {
      liveExamId: 'live-1',
      studentId: 'student-1',
      currentQuestion: 4,
      answeredCount: 3,
    });

    const activityWrite = db.runs.find(({ sql }) => sql.includes('INSERT INTO live_exam_activity'));
    expect(activityWrite).toBeDefined();
    expect(activityWrite?.sql).toContain('WHERE live_exam_activity.last_activity <= ?');
    expect(activityWrite?.bindings.at(-1)).toBe('2026-08-19T00:09:55.000Z');
  });
});
