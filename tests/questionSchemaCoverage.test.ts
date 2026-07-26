import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { validateQuestion } from '../schemas/quiz.schema';
import { AI_SELECTABLE_QUESTION_TYPES } from '../src/services/ai/question-contracts/questionTypeAvailability';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import { mapGeneratedQuizV3ToDomain } from '../src/services/ai/quizDomainAdapter';
import type { GeneratedQuestionV3 } from '../src/services/ai/question-contracts/questionContract.types';

describe('saved question schema coverage', () => {
  it('validates every AI contract after V3 domain mapping', () => {
    for (const [index, type] of AI_SELECTABLE_QUESTION_TYPES.entries()) {
      const question = {
        ...getAiQuestionContract(type).validFixture,
        slotId: `slot-${index + 1}`,
        type,
        difficulty: ((index % 3) + 1) as 1 | 2 | 3,
      } as GeneratedQuestionV3;
      const domainQuestion = mapGeneratedQuizV3ToDomain({
        promptVersion: 'ai-blueprint-v3',
        blueprintVersion: 3,
        title: `Fixture ${type}`,
        questions: [question],
      }).questions[0];

      expect(validateQuestion(domainQuestion).success, type).toBe(true);
    }
  });

  it('supports manual-only error correction', () => {
    expect(validateQuestion({
      id: 'error-1',
      type: QuestionType.ERROR_CORRECTION,
      question: 'Tìm và sửa từ viết sai.',
      passage: 'Bạn Lan rất ngoãn.',
      wrongWord: 'ngoãn',
      correctWord: 'ngoan',
      difficulty: 1,
    }).success).toBe(true);
  });

  it('keeps geometry outside this saved-schema rollout', () => {
    expect(validateQuestion({
      id: 'geometry-1',
      type: QuestionType.GEOMETRY,
      question: 'Quan sát hình.',
      geometryData: { kind: 'square' },
      difficulty: 1,
    }).success).toBe(false);
  });
});
