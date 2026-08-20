import { describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload = { id: 'student-1', username: 'student-1', role: 'student' };

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleLiveExamRoutes } from '../workers/src/routes/liveExam';

class StatusStatement {
  private args: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly preparedSql: string[],
  ) {}

  bind(...args: unknown[]) {
    this.args = args;
    return this;
  }

  async first() {
    if (this.sql.includes('FROM live_exam_sessions s')) {
      return {
        id: 'live-1',
        title: 'Exam',
        quiz_id: 'quiz-1',
        quiz_title: 'Quiz',
        teacher_id: 'teacher-1',
        class_id: 'class-1',
        class_name: 'Class 1',
        duration: 30,
        settings: '{}',
        status: 'waiting',
        access_code: 'ABC123',
        scheduled_at: null,
        started_at: null,
        ends_at: null,
        paused_at: null,
        closed_at: null,
        created_at: '2026-08-19T00:00:00.000Z',
        updated_at: '2026-08-19T00:00:00.000Z',
        chat_enabled: 1,
      };
    }
    if (this.sql.includes('SELECT * FROM live_exam_participants')) {
      return {
        id: 'participant-1',
        live_exam_id: 'live-1',
        student_id: String(this.args[1] ?? 'student-1'),
        individual_ends_at: null,
        submitted_at: null,
      };
    }
    if (this.sql.includes('SELECT COUNT(*) as count FROM live_exam_participants')) {
      return { count: 1 };
    }
    return null;
  }

  async all() {
    if (this.sql.includes('FROM live_exam_participants')) {
      return { results: [{
        id: 'participant-1', live_exam_id: 'live-1', student_id: 'student-1', username: 'student-1',
        joined_at: '2026-08-19T00:00:00.000Z', submitted_at: null, individual_ends_at: null,
        tab_switches: 0, created_at: '2026-08-19T00:00:00.000Z', updated_at: '2026-08-19T00:00:00.000Z',
      }] };
    }
    if (this.sql.includes('FROM live_exam_activity')) {
      return { results: [{
        student_id: 'student-1', current_question: 4, answered_count: 3,
        is_online: 1, last_activity: '2026-08-19T00:00:00.000Z',
      }] };
    }
    return { results: [] };
  }

  async run() {
    return { success: true, meta: { changes: 0 } };
  }
}

const createStatusDb = () => {
  const preparedSql: string[] = [];
  return {
    preparedSql,
    db: {
      prepare(sql: string) {
        preparedSql.push(sql);
        return new StatusStatement(sql, preparedSql);
      },
      batch: async () => [],
    },
  };
};

describe('Live Exam Polling V2 worker routes', () => {
  it('does not run a global expiry sweep on GET /status', async () => {
    currentUser = { id: 'student-1', username: 'student-1', role: 'student' };
    const { db, preparedSql } = createStatusDb();

    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-1/status'),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-1/status',
      'GET',
    );

    expect(response.status).toBe(200);
    expect(preparedSql.some((sql) => sql.includes('SELECT sessions.id FROM live_exam_sessions sessions'))).toBe(false);
    expect(preparedSql.some((sql) => sql.includes('UPDATE live_exam_participants') && sql.includes('WHERE submitted_at IS NULL'))).toBe(false);
  });

  it('keeps GET /participants read-only and derives stale presence from last_activity', async () => {
    currentUser = { id: 'teacher-1', username: 'teacher-1', role: 'teacher' };
    vi.setSystemTime('2026-08-19T00:02:00.000Z');
    const { db, preparedSql } = createStatusDb();

    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-1/participants'),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-1/participants',
      'GET',
    );
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(preparedSql.some((sql) => sql.includes('UPDATE live_exam_activity'))).toBe(false);
    expect(body.participants[0]).toMatchObject({ isOnline: false, connectionState: 'offline' });
    vi.useRealTimers();
  });
});
