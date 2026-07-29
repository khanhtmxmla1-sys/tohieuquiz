import { describe, expect, it } from 'vitest';
import {
  autoSubmitIncompleteAnswers,
  checkAndAutoCloseExpiredExams,
} from '../workers/src/services/liveExam/scoringService';
import {
  getEffectiveParticipantEndsAt,
  requireParticipantWorkWindow,
} from '../workers/src/services/liveExam/deadlineService';
import type { LiveExamSession } from '../src/types/liveExam.types';
import { LiveExamStatus } from '../src/types/liveExam.types';

class Statement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: Database) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    this.db.calls.push({ sql: this.sql, bindings: this.bindings });
    return this.db.participant as T | null;
  }

  async all<T>() {
    this.db.calls.push({ sql: this.sql, bindings: this.bindings });
    return { results: [] as T[] };
  }

  async run() {
    this.db.calls.push({ sql: this.sql, bindings: this.bindings });
    return { success: true, meta: { changes: 1 } };
  }
}

class Database {
  calls: Array<{ sql: string; bindings: unknown[] }> = [];
  participant: Record<string, unknown> | null = null;

  prepare(sql: string) {
    return new Statement(sql, this);
  }
}

const session = (overrides: Partial<LiveExamSession> = {}): LiveExamSession => ({
  id: 'live-1',
  title: 'Exam',
  quizId: 'quiz-1',
  teacherId: 'teacher-1',
  classId: 'class-1',
  duration: 30,
  startedAt: '2026-07-29T00:00:00.000Z',
  endsAt: '2020-01-01T00:00:00.000Z',
  settings: { randomizeAnswers: false, showLeaderboard: false, allowLateJoin: false },
  status: LiveExamStatus.ACTIVE,
  accessCode: 'ABC123',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
  ...overrides,
});

describe('Live Exam participant deadlines', () => {
  it('prefers the teacher-granted personal deadline', () => {
    expect(getEffectiveParticipantEndsAt(
      '2026-07-29T08:30:00.000Z',
      '2026-07-29T08:40:00.000Z',
    )).toBe('2026-07-29T08:40:00.000Z');
  });

  it('keeps an extended participant active after the room deadline', async () => {
    const db = new Database();
    db.participant = {
      id: 'participant-1',
      submitted_at: null,
      individual_ends_at: '2099-07-29T08:40:00.000Z',
    };

    await expect(requireParticipantWorkWindow(
      db as any,
      session(),
      'student-1',
    )).resolves.toMatchObject({ id: 'participant-1' });
  });

  it('auto-submit preserves the latest server autosave snapshot', async () => {
    const db = new Database();
    await autoSubmitIncompleteAnswers(db as any, 'live-1');

    const update = db.calls.find(({ sql }) => sql.includes('UPDATE live_exam_participants'));
    expect(update?.sql).toContain('live_exam_answer_snapshots');
    expect(update?.sql).toContain("COALESCE(answers");
  });

  it('closes only after all personal deadlines have expired', async () => {
    const db = new Database();
    await checkAndAutoCloseExpiredExams(db as any);

    const closeCandidateQuery = db.calls.find(({ sql }) => sql.includes('SELECT sessions.id'));
    expect(closeCandidateQuery?.sql).toContain('participants.individual_ends_at');
    expect(closeCandidateQuery?.sql).toContain('NOT EXISTS');
  });
});
