import { describe, expect, it } from 'vitest';
import { loadLiveExamQuiz } from '../workers/src/services/liveExam/quizLoader';

class Statement {
  constructor(readonly sql: string, private readonly db: CacheDb) {}
  bind() { return this; }
  async first<T>() {
    if (this.sql.includes('FROM quizzes')) {
      this.db.quizReads += 1;
      return {
        id: 'quiz-cache', title: 'Cached quiz', class_level: '4', time_limit: 30,
        created_at: '2026-08-19T00:00:00.000Z', created_by: 'teacher-1',
      } as T;
    }
    return null;
  }
  async all<T>() {
    if (this.sql.includes('FROM questions')) {
      this.db.questionReads += 1;
      return { results: [{
        id: 'q1', type: 'SHORT_ANSWER', question: '1+1?', question_rich_text: null,
        options: '', correct_answer: '2', items: '', text_field: '', blanks: '', distractors: '',
        sentence: '', words: '', correct_word_indexes: '', image: '', svg_content: '', svg_alt: '', difficulty: 1,
      }] as T[] };
    }
    return { results: [] as T[] };
  }
}

class CacheDb {
  quizReads = 0;
  questionReads = 0;
  prepare(sql: string) { return new Statement(sql, this); }
}

const session = {
  id: 'live-cache', quizId: 'quiz-cache', title: 'Cached quiz', duration: 30,
  teacherId: 'teacher-1', classId: 'class-1', status: 'active', accessCode: 'ABC123',
  settings: {}, createdAt: '2026-08-19T00:00:00.000Z', updatedAt: '2026-08-19T00:00:00.000Z',
} as any;

describe('Live Exam quiz load cache', () => {
  it('collapses concurrent loads for one session into one quiz read and one question read', async () => {
    const db = new CacheDb();

    const [first, second, third] = await Promise.all([
      loadLiveExamQuiz(db as any, session),
      loadLiveExamQuiz(db as any, session),
      loadLiveExamQuiz(db as any, session),
    ]);

    expect(first.questions).toHaveLength(1);
    expect(second.questions).toHaveLength(1);
    expect(third.questions).toHaveLength(1);
    expect(db.quizReads).toBe(1);
    expect(db.questionReads).toBe(1);
  });

  it('collapses a same-session burst even when requests receive different D1 binding wrappers', async () => {
    const firstDb = new CacheDb();
    const secondDb = new CacheDb();
    const wrappedSession = { ...session, id: 'live-cache-wrappers', quizId: 'quiz-cache-wrappers' };

    await Promise.all([
      loadLiveExamQuiz(firstDb as any, wrappedSession),
      loadLiveExamQuiz(secondDb as any, wrappedSession),
    ]);

    expect(firstDb.quizReads + secondDb.quizReads).toBe(1);
    expect(firstDb.questionReads + secondDb.questionReads).toBe(1);
  });
});
