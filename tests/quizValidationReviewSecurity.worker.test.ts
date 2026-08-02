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
      return new Statement([{
        id: 'q1', type: 'MCQ', question: '2 + 2?', options: '3|4', correct_answer: 'B',
        items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
        correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
      }]);
    }
    return new Statement([]);
  }
}

describe('quiz validation answer secrecy', () => {
  it('does not expose correct answers or review descriptors to a student validation request', async () => {
    const response = await handleValidateAnswers(new Database() as any, {
      quizId: 'quiz-1',
      answers: { q1: { type: 'MCQ', optionId: 'option-0' } },
    }, {
      includeCorrectAnswers: false,
      subject: { role: 'student', username: 'student-1', classIds: [] },
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as any;
    expect(payload.details).toEqual([expect.objectContaining({
      questionId: 'q1',
      isCorrect: false,
      status: 'wrong',
    })]);
    expect(payload.details[0]).not.toHaveProperty('correctAnswer');
    expect(payload).not.toHaveProperty('reviewDetails');
  });
});
