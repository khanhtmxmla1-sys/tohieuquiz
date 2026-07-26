import { describe, expect, it } from 'vitest';
import { AI_SELECTABLE_QUESTION_TYPES } from '../src/services/ai/question-contracts/questionTypeAvailability';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import {
  parseGeneratedQuizV3,
  GeneratedQuizV3Schema,
} from '../src/services/ai/schemas/quizGenerationSchema';

const makeAllTypeQuiz = () => ({
  promptVersion: 'ai-blueprint-v3' as const,
  blueprintVersion: 3 as const,
  title: 'Đề 13 dạng',
  questions: AI_SELECTABLE_QUESTION_TYPES.map((type, index) => ({
    ...getAiQuestionContract(type).validFixture,
    slotId: `slot-${index + 1}`,
    type,
    difficulty: ((index % 3) + 1) as 1 | 2 | 3,
  })),
});

describe('generated quiz V3 schema', () => {
  it('parses one valid question of every AI-selectable type', () => {
    const parsed = parseGeneratedQuizV3(makeAllTypeQuiz());
    expect(parsed.questions).toHaveLength(13);
    expect(parsed.questions.map((question) => question.type)).toEqual(AI_SELECTABLE_QUESTION_TYPES);
  });

  it('rejects duplicate slot ids at root', () => {
    const quiz = makeAllTypeQuiz();
    quiz.questions[1] = { ...quiz.questions[1], slotId: 'slot-1' };
    expect(() => parseGeneratedQuizV3(quiz)).toThrow('slotId');
  });

  it('rejects a manual-only question type', () => {
    const quiz = makeAllTypeQuiz();
    quiz.questions[0] = {
      slotId: 'slot-1',
      type: 'ERROR_CORRECTION',
      difficulty: 1,
      explanation: 'Lỗi cố ý.',
      question: 'Sửa lỗi.',
      passage: 'ngoãn',
      wrongWord: 'ngoãn',
      correctWord: 'ngoan',
    } as any;
    expect(GeneratedQuizV3Schema.safeParse(quiz).success).toBe(false);
  });

  it('rejects a contract-invalid question instead of inventing defaults', () => {
    const quiz = makeAllTypeQuiz();
    quiz.questions[0] = {
      ...quiz.questions[0],
      options: ['A', 'B'],
    } as any;
    expect(() => parseGeneratedQuizV3(quiz)).toThrow();
  });
});
