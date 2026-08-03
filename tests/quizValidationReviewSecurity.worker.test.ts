import { describe, expect, it } from 'vitest';
import { handleValidateAnswers } from '../workers/src/utils/helpers';

class Statement {
  constructor(private readonly rows: unknown[]) {}
  bind() { return this; }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: this.rows as T[] }; }
}

class Database {
  prepare(sql: string) {
    if (sql.includes('FROM questions')) {
      return new Statement([
        {
          id: 'q1', type: 'MCQ', question: '2 + 2?', options: '3|4', correct_answer: 'B',
          items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
          correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
        },
        {
          id: 'broken', type: 'SHORT_ANSWER', question: 'Điền', options: '', correct_answer: '',
          items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
          correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
        },
      ]);
    }
    return new Statement([]);
  }
}

describe('quiz validation answer secrecy', () => {
  it('does not expose correct answers and reports voided questions without rejecting the submission', async () => {
    const response = await handleValidateAnswers(new Database() as any, {
      quizId: 'quiz-1',
      answers: {
        q1: { type: 'MCQ', optionId: 'option-0' },
        broken: 'mine',
      },
    }, {
      includeCorrectAnswers: false,
      subject: { role: 'student', username: 'student-1', classIds: [] },
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as any;
    expect(payload).toMatchObject({
      questionCount: 2,
      totalQuestions: 1,
      total: 1,
      voidedCount: 1,
    });
    expect(payload.details).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        isCorrect: false,
        status: 'wrong',
      }),
      expect.objectContaining({
        questionId: 'broken',
        isCorrect: false,
        status: 'voided',
        issueCode: 'MISSING_CORRECT_ANSWER',
      }),
    ]);
    expect(payload.details[0]).not.toHaveProperty('correctAnswer');
    expect(payload.details[1]).not.toHaveProperty('correctAnswer');
    expect(payload).not.toHaveProperty('reviewDetails');
  });
});
