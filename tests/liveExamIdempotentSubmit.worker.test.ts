import { describe, expect, it } from 'vitest';
import { submitAnswers } from '../workers/src/services/liveExamService';
import { LiveExamServiceError } from '../workers/src/services/liveExam/errors';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.first(this.sql, this.bindings) as T | null; }
  async all<T>() { return { results: this.db.all(this.sql, this.bindings) as T[] }; }
  async run() { return this.db.run(this.sql, this.bindings); }
}

class Database {
  participantReads = 0;
  participantRows: Array<Record<string, unknown>> = [];
  updateChanges = 1;
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, _bindings: unknown[]): unknown {
    if (sql.includes('FROM live_exam_sessions s')) return {
      id: 'live-1', title: 'Exam', quiz_id: 'quiz-1', quiz_title: 'Quiz', teacher_id: 'teacher-1',
      class_id: 'class-1', class_name: 'Class 1', duration: 30, scheduled_at: null,
      started_at: '2026-07-28T00:00:00.000Z', ends_at: '2099-07-28T00:30:00.000Z',
      closed_at: null, settings: '{}', status: 'active', access_code: 'ABC123', chat_enabled: 1,
      archived_at: null, created_at: '2026-07-28T00:00:00.000Z', updated_at: '2026-07-28T00:00:00.000Z',
    };
    if (sql.includes('SELECT answers, score')) {
      return this.participantRows[Math.max(0, this.participantReads - 1)] ?? null;
    }
    if (sql.includes('SELECT id, submitted_at')) {
      const row = this.participantRows[Math.min(this.participantReads, this.participantRows.length - 1)] ?? null;
      this.participantReads += 1;
      return row;
    }
    if (sql.includes('SELECT id, title, class_level')) return {
      id: 'quiz-1', title: 'Quiz', class_level: '4', time_limit: 30,
      created_at: '2026-07-28T00:00:00.000Z', created_by: 'teacher-1',
    };
    return null;
  }
  all(sql: string): unknown[] {
    if (sql.includes('FROM questions')) return [{
      id: 'q1', type: 'MCQ', question: '1 + 1?', options: '1|2', correct_answer: 'B',
      items: '', blanks: '', distractors: '', words: '', correct_word_indexes: '',
    }];
    return [];
  }
  run(sql: string): unknown {
    if (sql.includes('UPDATE live_exam_participants')) return { success: true, meta: { changes: this.updateChanges } };
    return { success: true, meta: { changes: 1 } };
  }
}

const submittedParticipant = (answers: Record<string, string>) => ({
  id: 'participant-1',
  submitted_at: '2026-07-28T00:10:00.000Z',
  answers: JSON.stringify(answers),
  score: 10,
  correct_count: 1,
  wrong_count: 0,
  individual_ends_at: null,
});

describe('Live Exam idempotent submit', () => {
  it('returns the stored result for a replay with the same answers', async () => {
    const db = new Database();
    db.participantRows = [submittedParticipant({ q1: 'B' })];

    await expect(submitAnswers(db as any, {
      liveExamId: 'live-1', studentId: 'student-1', answers: { q1: 'B' },
      idempotencyKey: 'live-exam-submit:attempt-1',
    })).resolves.toEqual({
      score: 10, correctCount: 1, wrongCount: 0, submittedAt: '2026-07-28T00:10:00.000Z',
    });
  });

  it('rejects a replay that changes submitted answers', async () => {
    const db = new Database();
    db.participantRows = [submittedParticipant({ q1: 'B' })];

    await expect(submitAnswers(db as any, {
      liveExamId: 'live-1', studentId: 'student-1', answers: { q1: 'A' },
      idempotencyKey: 'live-exam-submit:attempt-2',
    })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(LiveExamServiceError);
      expect((error as LiveExamServiceError).status).toBe(409);
      return true;
    });
  });

  it('recovers a raced duplicate by reading the committed result', async () => {
    const db = new Database();
    db.updateChanges = 0;
    db.participantRows = [
      { id: 'participant-1', submitted_at: null, answers: null, score: null, correct_count: null, wrong_count: null },
      submittedParticipant({ q1: 'B' }),
    ];

    await expect(submitAnswers(db as any, {
      liveExamId: 'live-1', studentId: 'student-1', answers: { q1: 'B' },
      idempotencyKey: 'live-exam-submit:attempt-3',
    })).resolves.toMatchObject({ score: 10, submittedAt: '2026-07-28T00:10:00.000Z' });
  });
});
