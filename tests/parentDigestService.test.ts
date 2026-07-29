// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import type { ParentDashboardPayload } from '../shared/parent-portal.contract';
import {
  buildParentDigestSnapshot,
  createParentDigestEmail,
  runWeeklyParentDigests,
} from '../workers/src/parentPortal/digestService';
import { createParentEmailProvider, type ParentEmailMessage, type ParentEmailProvider } from '../workers/src/parentPortal/emailProvider';

class SQLiteStatement {
  private bindings: unknown[] = [];
  constructor(private readonly database: DatabaseSync, private readonly sql: string) {}
  bind(...bindings: unknown[]) { this.bindings = bindings; return this; }
  async first<T>() { return this.database.prepare(this.sql).get(...this.bindings as any[]) as T | null; }
  async all<T>() { return { results: this.database.prepare(this.sql).all(...this.bindings as any[]) as T[] }; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.bindings as any[]);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}
class SQLiteD1Adapter {
  constructor(private readonly database: DatabaseSync) {}
  prepare(sql: string) { return new SQLiteStatement(this.database, sql); }
  async batch(statements: SQLiteStatement[]) { return Promise.all(statements.map(statement => statement.run())); }
}

const privateDashboard: ParentDashboardPayload = {
  student: { id: 'student-secret', fullName: 'Nguyễn Văn Bí Mật', className: '4A9', avatar: 'secret-avatar' },
  period: { weekStart: '2026-07-27', weekEnd: '2026-08-02', previousWeekStart: '2026-07-20' },
  metrics: {
    completedQuizzes: 2,
    averageScore: 7.5,
    learningSeconds: 900,
    correctRate: 70,
    pendingAssignments: 1,
    unreadNotifications: 4,
  },
  comparison: { averageScoreDelta: 0.5, completedQuizzesDelta: 1 },
  subjects: [
    { subject: 'Toán', averageScore: 6, correctRate: 55, questionCount: 12, confidence: 'medium' },
    { subject: 'Tiếng Việt', averageScore: 9, correctRate: 90, questionCount: 20, confidence: 'high' },
  ],
  recentActivity: [{ id: 'result-secret', type: 'quiz', title: 'Đề bí mật', subject: 'Toán', score: 6, occurredAt: '2026-07-28T08:00:00.000Z' }],
  recommendations: ['Dành 15 phút ôn thêm môn Toán.'],
  importantNotifications: [{
    id: 'notification-secret',
    kind: 'quiz_result',
    title: 'Kết quả',
    body: 'Có đáp án',
    payload: { answers: { q1: 'A' } },
    isImportant: false,
    isRead: false,
    publishedAt: '2026-07-28T08:00:00.000Z',
    expiresAt: null,
  }],
};

const setupDigestDb = () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT, archived_at TEXT);
    CREATE TABLE students (id TEXT PRIMARY KEY, full_name TEXT, avatar TEXT, class_id TEXT, archived_at TEXT);
    CREATE TABLE parent_links (
      id TEXT PRIMARY KEY, student_id TEXT, access_code TEXT, pin_hash TEXT, status TEXT,
      token_version INTEGER, created_by TEXT, created_at TEXT, activated_at TEXT, revoked_at TEXT, last_accessed_at TEXT
    );
    CREATE TABLE quizzes (id TEXT PRIMARY KEY, category TEXT);
    CREATE TABLE results (
      id INTEGER PRIMARY KEY, student_id TEXT, quiz_id TEXT, quiz_title TEXT, score REAL,
      correct_count INTEGER, total_questions INTEGER, time_taken INTEGER, submitted_at TEXT
    );
    CREATE TABLE hw_assignments (
      id TEXT PRIMARY KEY, class_id TEXT, title TEXT, subject TEXT, status TEXT, archived_at TEXT, deadline TEXT
    );
    CREATE TABLE hw_submissions (
      id TEXT PRIMARY KEY, assignment_id TEXT, student_id TEXT, published_at TEXT, score REAL, submitted_at TEXT
    );
    CREATE TABLE parent_notifications (
      id TEXT PRIMARY KEY, student_id TEXT, kind TEXT, source_type TEXT, source_id TEXT,
      title TEXT, body TEXT, payload_json TEXT, is_important INTEGER, published_at TEXT,
      expires_at TEXT, read_at TEXT, revoked_at TEXT, created_by TEXT, created_at TEXT
    );
  `);
  sqlite.exec(readFileSync('workers/migrations/0048_parent_digest_recovery.sql', 'utf8'));
  sqlite.exec(`
    INSERT INTO classes(id, name, archived_at) VALUES ('class-1', '4A9', NULL);
    INSERT INTO students(id, full_name, avatar, class_id, archived_at)
      VALUES ('student-1', 'Nguyễn Văn Bí Mật', '', 'class-1', NULL);
    INSERT INTO parent_links(id, student_id, access_code, status, token_version, created_by, created_at)
      VALUES ('link-1', 'student-1', 'ABCDEFG234', 'ACTIVE', 1, 'teacher-a', '2026-07-20T00:00:00.000Z');
    INSERT INTO parent_contact_preferences(
      link_id, email, email_normalized, email_verified_at, weekly_digest_enabled,
      digest_weekday, digest_hour, timezone, quiet_hours_enabled,
      quiet_hours_start_minute, quiet_hours_end_minute, email_kinds_json, created_at, updated_at
    ) VALUES (
      'link-1', 'parent@example.com', 'parent@example.com', '2026-07-20T00:00:00.000Z', 1,
      3, 15, 'Asia/Ho_Chi_Minh', 1, 1260, 420, '[]',
      '2026-07-20T00:00:00.000Z', '2026-07-20T00:00:00.000Z'
    );
    INSERT INTO quizzes(id, category) VALUES ('quiz-1', 'Toán');
    INSERT INTO results(id, student_id, quiz_id, quiz_title, score, correct_count, total_questions, time_taken, submitted_at)
      VALUES (1, 'student-1', 'quiz-1', 'Ôn tập Toán', 6, 6, 10, 600, '2026-07-28T08:00:00.000Z');
    INSERT INTO hw_assignments(id, class_id, title, subject, status, archived_at, deadline)
      VALUES ('hw-1', 'class-1', 'Bài đang chờ', 'Toán', 'OPEN', NULL, '2026-08-02T00:00:00.000Z');
  `);
  return { sqlite, db: new SQLiteD1Adapter(sqlite) as unknown as D1Database };
};

describe('parent weekly digest privacy and delivery', () => {
  it('derives a minimal snapshot and email without student identity, history IDs or answer data', () => {
    const snapshot = buildParentDigestSnapshot(privateDashboard);
    const email = createParentDigestEmail(snapshot);
    const serialized = JSON.stringify({ snapshot, email });

    expect(snapshot.supportAreas).toEqual([{ subject: 'Toán', correctRate: 55, confidence: 'medium' }]);
    for (const secret of [
      'student-secret', 'Nguyễn Văn Bí Mật', '4A9', 'secret-avatar',
      'result-secret', 'notification-secret', 'answers', 'Đề bí mật',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain('Dành 15 phút ôn thêm môn Toán.');
  });

  it('sends one idempotent digest per week and stores only the minimized snapshot', async () => {
    const { sqlite, db } = setupDigestDb();
    const messages: ParentEmailMessage[] = [];
    const provider: ParentEmailProvider = {
      ready: true,
      reason: null,
      send: vi.fn(async (message) => {
        messages.push(message);
        return { messageId: 'provider-1' };
      }),
    };
    const now = new Date('2026-07-29T08:00:00.000Z'); // 15:00 Wednesday in ICT.

    const first = await runWeeklyParentDigests(db, provider, now);
    const replay = await runWeeklyParentDigests(db, provider, now);

    expect(first).toMatchObject({ rolloutReady: true, eligibleCount: 1, sentCount: 1, failedCount: 0 });
    expect(replay).toMatchObject({ eligibleCount: 1, sentCount: 0, skippedCount: 1 });
    expect(messages).toHaveLength(1);
    const stored = sqlite.prepare('SELECT status, payload_json FROM parent_digest_runs').get() as {
      status: string;
      payload_json: string;
    };
    expect(stored.status).toBe('SENT');
    expect(JSON.parse(stored.payload_json)).toMatchObject({ completedQuizzes: 1, pendingAssignments: 1 });
    for (const secret of ['Nguyễn Văn Bí Mật', '4A9', 'parent@example.com', 'student-1', 'quiz-1']) {
      expect(stored.payload_json).not.toContain(secret);
      expect(JSON.stringify(messages[0])).not.toContain(secret === 'parent@example.com' ? '__not_applicable__' : secret);
    }
    expect(messages[0].to).toBe('parent@example.com');
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM parent_digest_runs').get()).toEqual({ count: 1 });
  });

  it('keeps the HTTP provider disabled until SPF, DKIM and DMARC are all ready', () => {
    const provider = createParentEmailProvider({
      PARENT_EMAIL_PROVIDER: 'http',
      PARENT_EMAIL_API_URL: 'https://mail.example.test/send',
      PARENT_EMAIL_API_TOKEN: 'test-token',
      PARENT_EMAIL_FROM: 'TôHiệuQuiz <noreply@example.test>',
      PARENT_EMAIL_PUBLIC_BASE_URL: 'https://phuhuynh.example.test',
      PARENT_EMAIL_SPF_READY: 'true',
      PARENT_EMAIL_DKIM_READY: 'false',
      PARENT_EMAIL_DMARC_READY: 'true',
    } as any);
    expect(provider.ready).toBe(false);
    expect(provider.reason).toBe('domain_authentication_incomplete');
  });
});
