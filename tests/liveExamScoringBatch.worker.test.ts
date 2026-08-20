import { describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/gamification/liveExamReward', () => ({
  awardClosedLiveExamRewards: vi.fn(async () => undefined),
}));

import { calculateScoresAndClose } from '../workers/src/services/liveExam/scoringService';

class Statement {
  bindings: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly db: BatchDb,
  ) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    return this.db.first(this.sql) as T | null;
  }

  async all<T>() {
    return { results: this.db.all(this.sql) as T[] };
  }

  async run() {
    this.db.sequentialRuns.push(this);
    return { success: true, meta: { changes: 1 } };
  }
}

class BatchDb {
  sequentialRuns: Statement[] = [];
  batches: Statement[][] = [];

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  async batch(statements: Statement[]) {
    this.batches.push(statements);
    return statements.map(() => ({ success: true, meta: { changes: 1 } }));
  }

  first(sql: string) {
    if (sql.includes('FROM live_exam_sessions s')) {
      return {
        id: 'live-batch', title: 'Batch exam', quiz_id: 'quiz-batch', quiz_title: 'Batch quiz',
        teacher_id: 'teacher-1', class_id: 'class-1', class_name: '4A', duration: 30,
        scheduled_at: null, started_at: '2026-08-19T00:00:00.000Z', ends_at: '2099-08-19T00:30:00.000Z',
        closed_at: null, settings: '{}', status: 'scoring', access_code: 'ABC123', chat_enabled: 1,
        archived_at: null, created_at: '2026-08-19T00:00:00.000Z', updated_at: '2026-08-19T00:00:00.000Z',
      };
    }
    if (sql.includes('FROM quizzes')) {
      return {
        id: 'quiz-batch', title: 'Batch quiz', class_level: '4', time_limit: 30,
        created_at: '2026-08-19T00:00:00.000Z', created_by: 'teacher-1',
      };
    }
    return null;
  }

  all(sql: string) {
    if (sql.includes('FROM questions')) {
      return [{
        id: 'q1', type: 'SHORT_ANSWER', question: '2 + 2?', question_rich_text: null,
        options: '', correct_answer: '4', items: '', text_field: '', blanks: '', distractors: '',
        sentence: '', words: '', correct_word_indexes: '', image: '', svg_content: '', svg_alt: '', difficulty: 1,
      }];
    }
    if (sql.includes('FROM live_exam_participants')) {
      return [
        {
          id: 'p1', live_exam_id: 'live-batch', student_id: 's1', username: 's1',
          joined_at: '2026-08-19T00:00:00.000Z', submitted_at: '2026-08-19T00:10:00.000Z',
          answers: JSON.stringify({ q1: { type: 'SHORT_ANSWER', value: '4' } }), tab_switches: 0,
          created_at: '2026-08-19T00:00:00.000Z', updated_at: '2026-08-19T00:10:00.000Z',
        },
        {
          id: 'p2', live_exam_id: 'live-batch', student_id: 's2', username: 's2',
          joined_at: '2026-08-19T00:00:01.000Z', submitted_at: '2026-08-19T00:10:01.000Z',
          answers: JSON.stringify({ q1: { type: 'SHORT_ANSWER', value: 'wrong' } }), tab_switches: 0,
          created_at: '2026-08-19T00:00:01.000Z', updated_at: '2026-08-19T00:10:01.000Z',
        },
      ];
    }
    return [];
  }
}

describe('Live Exam scoring close batching', () => {
  it('batches all participant score updates and the session close in one D1 batch', async () => {
    const db = new BatchDb();

    await calculateScoresAndClose(db as any, 'live-batch');

    expect(db.batches).toHaveLength(1);
    expect(db.batches[0]).toHaveLength(3);
    expect(db.batches[0].filter((statement) => statement.sql.includes('UPDATE live_exam_participants'))).toHaveLength(2);
    expect(db.batches[0].filter((statement) => statement.sql.includes('UPDATE live_exam_sessions'))).toHaveLength(1);
    expect(db.sequentialRuns).toHaveLength(0);
  });
});
