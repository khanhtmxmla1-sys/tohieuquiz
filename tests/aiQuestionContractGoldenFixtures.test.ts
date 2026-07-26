import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import mcq from './fixtures/ai-question-contracts/mcq.valid.json';
import trueFalse from './fixtures/ai-question-contracts/true-false.valid.json';
import shortAnswer from './fixtures/ai-question-contracts/short-answer.valid.json';
import matching from './fixtures/ai-question-contracts/matching.valid.json';
import multipleSelect from './fixtures/ai-question-contracts/multiple-select.valid.json';
import dragDrop from './fixtures/ai-question-contracts/drag-drop.valid.json';
import ordering from './fixtures/ai-question-contracts/ordering.valid.json';
import imageQuestion from './fixtures/ai-question-contracts/image-question.valid.json';
import dropdown from './fixtures/ai-question-contracts/dropdown.valid.json';
import underline from './fixtures/ai-question-contracts/underline.valid.json';
import categorization from './fixtures/ai-question-contracts/categorization.valid.json';
import wordScramble from './fixtures/ai-question-contracts/word-scramble.valid.json';
import riddle from './fixtures/ai-question-contracts/riddle.valid.json';

const fixtures = new Map<QuestionType, unknown>([
  [QuestionType.MCQ, mcq],
  [QuestionType.TRUE_FALSE, trueFalse],
  [QuestionType.SHORT_ANSWER, shortAnswer],
  [QuestionType.MATCHING, matching],
  [QuestionType.MULTIPLE_SELECT, multipleSelect],
  [QuestionType.DRAG_DROP, dragDrop],
  [QuestionType.ORDERING, ordering],
  [QuestionType.IMAGE_QUESTION, imageQuestion],
  [QuestionType.DROPDOWN, dropdown],
  [QuestionType.UNDERLINE, underline],
  [QuestionType.CATEGORIZATION, categorization],
  [QuestionType.WORD_SCRAMBLE, wordScramble],
  [QuestionType.RIDDLE, riddle],
]);

describe('AI question contract golden fixtures', () => {
  it('keeps one valid JSON fixture for every AI-selectable contract', () => {
    expect(fixtures).toHaveLength(13);
    for (const [type, fixture] of fixtures) {
      expect(getAiQuestionContract(type).schema.safeParse(fixture).success, type).toBe(true);
    }
  });
});
