import { describe, expect, it } from 'vitest';
import {
  filterActiveQuizzes,
  isArchivedQuizCategory,
} from '../src/domain/quiz/quizCategoryPolicy';

describe('quiz category policy', () => {
  it('archives the removed legacy category regardless of casing or whitespace', () => {
    expect(isArchivedQuizCategory('ioe')).toBe(true);
    expect(isArchivedQuizCategory(' IOE ')).toBe(true);
  });

  it('keeps ordinary English and other subjects active', () => {
    expect(isArchivedQuizCategory('tieng-anh')).toBe(false);
    expect(isArchivedQuizCategory('toan')).toBe(false);
  });

  it('filters archived quizzes without mutating the input', () => {
    const quizzes = [
      { id: 'legacy', category: 'ioe' },
      { id: 'english', category: 'tieng-anh' },
    ];

    expect(filterActiveQuizzes(quizzes)).toEqual([{ id: 'english', category: 'tieng-anh' }]);
    expect(quizzes).toHaveLength(2);
  });
});
