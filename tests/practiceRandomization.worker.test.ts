// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { handlePracticeRoutes } from '../workers/src/routes/practice';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: PracticeDb) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async all<T>() { return { results: this.db.all(this.sql) as T[] }; }
}

class PracticeDb {
  sql: string[] = [];
  constructor(private readonly practiceRandom: boolean) {}
  prepare(sql: string) { this.sql.push(sql); return new Statement(sql, this); }
  all(sql: string) {
    if (sql.includes('FROM system_settings')) {
      return [{
        setting_key: 'quiz_randomize_practice_selection',
        setting_value: this.practiceRandom ? 'true' : 'false',
        updated_at: '2026-08-14T00:00:00.000Z',
      }];
    }
    if (sql.includes('FROM questions')) {
      return [{
        id: 'q-1', quiz_id: 'quiz-1', type: 'MCQ', question: '1 + 1?',
        options: '1|2', correct_answer: 'B', items: '', text_field: '', blanks: '',
        distractors: '', sentence: '', words: '', correct_word_indexes: '', image: '',
        svg_content: '', svg_alt: '', tags: '#Toan',
      }];
    }
    return [];
  }
}

const runPractice = async (db: PracticeDb) => handlePracticeRoutes(
  new Request('https://test/api/practice?topic=Toan&limit=1'),
  { DB: db } as any,
  '/api/practice',
  'GET',
);

describe('practice randomization policy', () => {
  it('uses canonical row order when practice random selection is disabled', async () => {
    const db = new PracticeDb(false);
    const response = await runPractice(db);
    expect(response.status).toBe(200);
    const questionSql = db.sql.find((sql) => sql.includes('FROM questions')) || '';
    expect(questionSql).toContain('ORDER BY rowid ASC');
    expect(questionSql).not.toContain('ORDER BY RANDOM()');
  });

  it('keeps random question selection when practice random selection is enabled', async () => {
    const db = new PracticeDb(true);
    const response = await runPractice(db);
    expect(response.status).toBe(200);
    const questionSql = db.sql.find((sql) => sql.includes('FROM questions')) || '';
    expect(questionSql).toContain('ORDER BY RANDOM()');
  });
});
