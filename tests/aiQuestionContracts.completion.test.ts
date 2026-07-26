import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  DRAG_DROP_CONTRACT,
  DROPDOWN_CONTRACT,
  SHORT_ANSWER_CONTRACT,
} from '../src/services/ai/question-contracts/completionQuestionContracts';

const slotFor = (type: QuestionType.SHORT_ANSWER | QuestionType.DRAG_DROP | QuestionType.DROPDOWN) => ({
  slotId: 'slot-1',
  ordinal: 1,
  type,
  difficulty: 2 as const,
  objective: 'Hoàn thành câu hỏi',
  imagePolicy: 'optional' as const,
});

describe('completion question contracts', () => {
  it('allows a meaningful short answer longer than four characters', () => {
    expect(SHORT_ANSWER_CONTRACT.schema.safeParse({
      ...SHORT_ANSWER_CONTRACT.validFixture,
      correctAnswer: 'Hà Nội',
    }).success).toBe(true);
  });

  it('rejects ambiguous alternative short answers', () => {
    const question = { ...SHORT_ANSWER_CONTRACT.validFixture, correctAnswer: 'Hà Nội hoặc Thăng Long' };
    const issues = SHORT_ANSWER_CONTRACT.validateSemantics(question, slotFor(QuestionType.SHORT_ANSWER));
    expect(issues.some((issue) => issue.code === 'SHORT_ANSWER_AMBIGUOUS')).toBe(true);
  });

  it('rejects non-sequential drag-drop markers', () => {
    const question = {
      ...DRAG_DROP_CONTRACT.validFixture,
      text: 'Điền [1] rồi [3].',
      blanks: ['một', 'ba'],
    };
    const issues = DRAG_DROP_CONTRACT.validateSemantics(question, slotFor(QuestionType.DRAG_DROP));
    expect(issues.some((issue) => issue.code === 'DRAG_DROP_MARKERS_INVALID')).toBe(true);
  });

  it('requires dropdown ids to match text markers', () => {
    const question = {
      ...DROPDOWN_CONTRACT.validFixture,
      text: 'Thủ đô là [1].',
      blanks: [{ id: '2', options: ['Hà Nội', 'Huế'], correctAnswer: 'Hà Nội' }],
    };
    const issues = DROPDOWN_CONTRACT.validateSemantics(question, slotFor(QuestionType.DROPDOWN));
    expect(issues.some((issue) => issue.code === 'DROPDOWN_MARKER_ID_MISMATCH')).toBe(true);
  });
});
