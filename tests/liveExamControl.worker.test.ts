import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/services/liveExam/scoringService', () => ({
  autoSubmitIncompleteAnswers: vi.fn(async () => undefined),
  calculateScoresAndClose: vi.fn(async () => undefined),
}));

import {
  endExamEarly,
  extendParticipantTime,
  pauseExam,
  prepareEndExamEarly,
  resumeExam,
} from '../workers/src/services/liveExam/sessionControlService';
import { LiveExamServiceError } from '../workers/src/services/liveExam/errors';

class Statement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: Database) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    return this.db.first(this.sql) as T | null;
  }

  async run() {
    return this.db.run(this.sql, this.bindings);
  }
}

class Database {
  statements: Array<{ sql: string; bindings: unknown[] }> = [];
  status: 'active' | 'paused' = 'active';
  pausedAt: string | null = null;
  endsAt = '2099-07-29T08:30:00.000Z';
  participant = {
    id: 'participant-1',
    submitted_at: null as string | null,
    individual_ends_at: null as string | null,
  };
  confirmationHash = '';
  confirmationConsumed = false;

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  async batch(statements: Statement[]) {
    return Promise.all(statements.map((statement) => statement.run()));
  }

  first(sql: string) {
    if (sql.includes('FROM live_exam_sessions s')) {
      return {
        id: 'live-1',
        title: 'Exam',
        quiz_id: 'quiz-1',
        quiz_title: 'Quiz',
        teacher_id: 'teacher-1',
        class_id: 'class-1',
        class_name: 'Class 1',
        duration: 30,
        scheduled_at: null,
        started_at: '2099-07-29T08:00:00.000Z',
        ends_at: this.endsAt,
        paused_at: this.pausedAt,
        total_paused_seconds: 0,
        closed_at: null,
        settings: '{}',
        status: this.status,
        access_code: 'ABC123',
        chat_enabled: 1,
        archived_at: null,
        created_at: '2099-07-29T07:50:00.000Z',
        updated_at: '2099-07-29T08:00:00.000Z',
      };
    }
    if (sql.includes('FROM live_exam_participants')) return this.participant;
    return null;
  }

  run(sql: string, bindings: unknown[]) {
    this.statements.push({ sql, bindings });
    if (sql.includes("SET status = 'paused'")) {
      this.status = 'paused';
      this.pausedAt = String(bindings[0]);
    } else if (sql.includes("SET status = 'active', ends_at")) {
      this.status = 'active';
      this.endsAt = String(bindings[0]);
      this.pausedAt = null;
    } else if (sql.includes('SET individual_ends_at = ?')) {
      this.participant.individual_ends_at = String(bindings[0]);
    } else if (sql.includes('INSERT INTO live_exam_control_confirmations')) {
      this.confirmationHash = String(bindings[3]);
      this.confirmationConsumed = false;
    } else if (sql.includes('UPDATE live_exam_control_confirmations')) {
      const suppliedHash = String(bindings[3]);
      if (!this.confirmationConsumed && suppliedHash === this.confirmationHash) {
        this.confirmationConsumed = true;
        return { success: true, meta: { changes: 1 } };
      }
      return { success: true, meta: { changes: 0 } };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

describe('Live Exam teacher controls', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database();
  });

  it('pauses and resumes while shifting room and personal deadlines', async () => {
    await pauseExam(db as any, 'live-1', 'teacher-1', false, 'request-pause');
    expect(db.status).toBe('paused');
    expect(db.statements.some(({ sql }) => sql.includes("action") && sql.includes('live_exam_control_audit'))).toBe(true);

    db.participant.individual_ends_at = '2099-07-29T08:35:00.000Z';
    db.pausedAt = new Date(Date.now() - 65_000).toISOString();
    const beforeResume = Date.parse(db.endsAt);
    await resumeExam(db as any, 'live-1', 'teacher-1', false, 'request-resume');

    expect(db.status).toBe('active');
    expect(Date.parse(db.endsAt)).toBeGreaterThan(beforeResume);
    expect(db.statements.some(({ sql }) => sql.includes("strftime('%Y-%m-%dT%H:%M:%fZ'"))).toBe(true);
  });

  it('grants a personal extension and records only control metadata', async () => {
    const extendedEndsAt = await extendParticipantTime(
      db as any,
      'live-1',
      'participant-1',
      5,
      'teacher-1',
      false,
      'request-extend',
    );

    expect(Date.parse(extendedEndsAt)).toBeGreaterThan(Date.parse(db.endsAt));
    const audit = db.statements.find(({ sql, bindings }) => (
      sql.includes('INSERT INTO live_exam_control_audit')
      && bindings.includes('extend_participant')
    ));
    expect(audit?.bindings.join(' ')).toContain('extraMinutes');
    expect(audit?.bindings.join(' ')).not.toContain('answers');
  });

  it('requires a hashed, single-use confirmation before ending early', async () => {
    const prepared = await prepareEndExamEarly(
      db as any,
      'live-1',
      'teacher-1',
      false,
      'request-prepare',
    );

    expect(prepared.confirmationToken.length).toBeGreaterThanOrEqual(64);
    expect(db.confirmationHash).not.toBe(prepared.confirmationToken);
    expect(db.confirmationHash).toMatch(/^[a-f0-9]{64}$/);

    await expect(endExamEarly(
      db as any,
      'live-1',
      'teacher-1',
      prepared.confirmationToken,
      'Kết thúc theo lịch nhà trường',
      false,
      'request-end',
    )).resolves.toBeUndefined();

    await expect(endExamEarly(
      db as any,
      'live-1',
      'teacher-1',
      prepared.confirmationToken,
      'Thử sử dụng lại xác nhận',
      false,
      'request-replay',
    )).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(LiveExamServiceError);
      expect((error as LiveExamServiceError).status).toBe(409);
      return true;
    });
  });
});
