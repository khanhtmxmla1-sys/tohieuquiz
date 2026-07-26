import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  RIDDLE_CONTRACT,
  UNDERLINE_CONTRACT,
  WORD_SCRAMBLE_CONTRACT,
  normalizeUnderlineTargets,
} from '../src/services/ai/question-contracts/languageQuestionContracts';

const slotFor = (type: QuestionType.UNDERLINE | QuestionType.WORD_SCRAMBLE | QuestionType.RIDDLE) => ({
  slotId: 'slot-1',
  ordinal: 1,
  type,
  difficulty: 2 as const,
  objective: 'Luyện Tiếng Việt',
  imagePolicy: 'optional' as const,
});

describe('language question contracts', () => {
  it('maps unique target words to indexes instead of trusting AI indexes', () => {
    const normalized = normalizeUnderlineTargets({
      sentence: 'Bạn Lan chăm chỉ học bài.',
      targetWords: ['chăm', 'chỉ'],
    });
    expect(normalized.words).toEqual(['Bạn', 'Lan', 'chăm', 'chỉ', 'học', 'bài.']);
    expect(normalized.correctWordIndexes).toEqual([2, 3]);
  });

  it('rejects an ambiguous repeated underline target', () => {
    expect(() => normalizeUnderlineTargets({
      sentence: 'Hoa hái hoa.',
      targetWords: ['hoa'],
    })).toThrow('Từ mục tiêu xuất hiện nhiều lần');
  });

  it('preserves Vietnamese diacritics when validating word scramble', () => {
    const question = {
      ...WORD_SCRAMBLE_CONTRACT.validFixture,
      letters: ['h', 'o', 'a'],
      correctWord: 'hòa',
    };
    const issues = WORD_SCRAMBLE_CONTRACT.validateSemantics(
      question,
      slotFor(QuestionType.WORD_SCRAMBLE),
    );
    expect(issues.some((issue) => issue.code === 'WORD_SCRAMBLE_LETTERS_MISMATCH')).toBe(true);
  });

  it('requires two to six riddle lines', () => {
    expect(RIDDLE_CONTRACT.schema.safeParse({
      ...RIDDLE_CONTRACT.validFixture,
      riddleLines: ['Chỉ một dòng'],
    }).success).toBe(false);
  });

  it('accepts the underline fixture through its contract schema', () => {
    expect(UNDERLINE_CONTRACT.schema.safeParse(UNDERLINE_CONTRACT.validFixture).success).toBe(true);
  });
});
