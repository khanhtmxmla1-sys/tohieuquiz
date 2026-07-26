import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { auditGeneratedQuizV3 } from '../src/services/ai/quizAudit';
import type { GeneratedQuizV3 } from '../src/services/ai/question-contracts/questionContract.types';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import {
  makeBlueprintV3Fixture,
  makeGeneratedQuizV3Fixture,
} from './helpers/aiBlueprintV3Fixtures';

const blueprint = makeBlueprintV3Fixture();
const validQuiz = makeGeneratedQuizV3Fixture(blueprint);

describe('generated quiz V3 slot audit', () => {
  it('reports missing, duplicate and unexpected slots independently', () => {
    const quiz: GeneratedQuizV3 = {
      ...validQuiz,
      questions: [
        validQuiz.questions[0],
        { ...validQuiz.questions[0] },
        { ...validQuiz.questions[1], slotId: 'slot-999' },
        ...validQuiz.questions.slice(2, 3),
      ],
    };

    const codes = auditGeneratedQuizV3(quiz, blueprint).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      'MISSING_SLOT',
      'DUPLICATE_SLOT',
      'UNEXPECTED_SLOT',
    ]));
  });

  it('does not accept the correct total when slot identity carries the wrong type', () => {
    const quiz: GeneratedQuizV3 = {
      ...validQuiz,
      questions: validQuiz.questions.map((question, index) => {
        if (index === 0) return { ...question, slotId: blueprint.slots[1].slotId };
        if (index === 1) return { ...question, slotId: blueprint.slots[0].slotId };
        return question;
      }),
    };

    expect(quiz.questions).toHaveLength(blueprint.totalQuestions);
    expect(auditGeneratedQuizV3(quiz, blueprint).some(
      (issue) => issue.code === 'SLOT_TYPE_MISMATCH',
    )).toBe(true);
  });

  it('reports semantic contract failures', () => {
    const slot = {
      ...blueprint.slots[0],
      type: QuestionType.TRUE_FALSE,
    };
    const localBlueprint = {
      ...blueprint,
      totalQuestions: 1,
      slots: [{ ...slot, slotId: 'slot-1', ordinal: 1 }],
    };
    const contract = getAiQuestionContract(QuestionType.TRUE_FALSE);
    const quiz: GeneratedQuizV3 = {
      promptVersion: 'ai-blueprint-v3',
      blueprintVersion: 3,
      title: 'Đề lỗi ngữ nghĩa',
      questions: [{
        ...contract.validFixture,
        slotId: 'slot-1',
        type: QuestionType.TRUE_FALSE,
        difficulty: slot.difficulty,
        items: contract.validFixture.items.map((item: any) => ({ ...item, isCorrect: true })),
      }],
    };

    expect(auditGeneratedQuizV3(quiz, localBlueprint).some(
      (issue) => issue.code === 'QUESTION_SEMANTIC_INVALID',
    )).toBe(true);
  });

  it('reports skill and math mismatches', () => {
    const quiz: GeneratedQuizV3 = {
      ...validQuiz,
      questions: validQuiz.questions.map((question, index) => index === 0
        ? {
          ...question,
          subject: 'vietnamese',
          skillCode: 'doc_hieu',
          question: 'Tính $\\frac{1}{2$ + 1.',
        }
        : question),
    };

    const codes = auditGeneratedQuizV3(quiz, blueprint).map((issue) => issue.code);
    expect(codes).toContain('SLOT_SKILL_MISMATCH');
    expect(codes).toContain('MATH_FORMAT_INVALID');
  });
});
