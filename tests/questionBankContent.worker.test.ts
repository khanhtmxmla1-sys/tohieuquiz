// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  canonicalizeQuestionData,
  hashQuestionData,
} from '../workers/src/services/questionBankContent';

const base = {
  id: 'question-a',
  type: 'MCQ',
  question: '  Kết quả của   2 + 2 là bao nhiêu?  ',
  options: ['3', '4'],
  correctAnswer: 'B',
  difficulty: 1,
  tags: ['Toán', 'Lớp 5'],
  subject: 'MATH',
  grade: 5,
  topicCode: 'M5-S1-T01',
  lessonCode: 'M5-S1-L01',
};

describe('question-bank canonical content hashing', () => {
  it('ignores identity and classification metadata while normalizing keys and whitespace', async () => {
    const first = {
      ...base,
      id: 'a',
      tags: ['x'],
      question: 'Kết quả của 2 + 2 là bao nhiêu?',
    };
    const second = {
      lessonCode: 'other-lesson',
      topicCode: 'other-topic',
      grade: 4,
      subject: 'OTHER',
      tags: ['y'],
      id: 'b',
      correctAnswer: 'B',
      options: ['3', '4'],
      question: '  Kết quả của   2 + 2 là bao nhiêu? ',
      type: 'MCQ',
      difficulty: 1,
    };

    expect(canonicalizeQuestionData(first)).toBe(canonicalizeQuestionData(second));
    await expect(hashQuestionData(first)).resolves.toBe(await hashQuestionData(second));
  });

  it('preserves meaningful array order and answer content', async () => {
    expect(await hashQuestionData({ ...base, options: ['4', '3'] }))
      .not.toBe(await hashQuestionData(base));
    expect(await hashQuestionData({ ...base, correctAnswer: 'A' }))
      .not.toBe(await hashQuestionData(base));
  });

  it('returns deterministic lowercase SHA-256 hex', async () => {
    const hash = await hashQuestionData(base);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(await hashQuestionData({ ...base }));
  });
});
