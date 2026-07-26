import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { auditGeneratedQuiz } from '../src/services/ai/quizAudit';
import { parseGeneratedQuiz } from '../src/services/ai/schemas/quizGenerationSchema';
import type { QuizBlueprint } from '../src/features/quiz-generator/domain/quizBlueprint';

const makeMcq = (question: string, difficultyLevel = 2) => ({
  type: QuestionType.MCQ,
  question,
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'A',
  explanation: 'Giải thích đầy đủ.',
  difficultyLevel,
});

const blueprintFor = (totalQuestions: number): QuizBlueprint => ({
  intent: 'EXAM',
  sourceMode: 'TOPIC',
  totalQuestions,
  typeAllocations: [{ type: QuestionType.MCQ, count: totalQuestions }],
  difficultyLevels: { level1: 0, level2: totalQuestions, level3: 0 },
});

describe('generated quiz audit', () => {
  it('reports a missing question instead of slicing silently', () => {
    const quiz = parseGeneratedQuiz({
      title: 'Đề 9 câu',
      questions: Array.from({ length: 9 }, (_, index) => makeMcq(`Câu số ${index + 1}: chọn đáp án đúng`)),
    });

    const issues = auditGeneratedQuiz(quiz, blueprintFor(10));

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'QUESTION_COUNT_MISMATCH',
      repairable: true,
    }));
  });

  it('reports near-duplicate questions after normalizing numbers and punctuation', () => {
    const quiz = parseGeneratedQuiz({
      title: 'Đề trùng',
      questions: [
        makeMcq('Tính 12 + 5 rồi chọn kết quả đúng.'),
        makeMcq('Tính 23 + 8, rồi chọn kết quả đúng!'),
      ],
    });

    const issues = auditGeneratedQuiz(quiz, blueprintFor(2));

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_QUESTION',
      questionIndexes: [1],
      repairable: true,
    }));
  });

  it('reports type and difficulty allocation mismatches', () => {
    const quiz = parseGeneratedQuiz({
      title: 'Đề lệch blueprint',
      questions: [makeMcq('Câu dễ', 1), makeMcq('Câu khó', 3)],
    });
    const blueprint: QuizBlueprint = {
      ...blueprintFor(2),
      typeAllocations: [
        { type: QuestionType.MCQ, count: 1 },
        { type: QuestionType.SHORT_ANSWER, count: 1 },
      ],
      difficultyLevels: { level1: 0, level2: 2, level3: 0 },
    };

    const issues = auditGeneratedQuiz(quiz, blueprint);

    expect(issues.some((issue) => issue.code === 'TYPE_COUNT_MISMATCH')).toBe(true);
    expect(issues.some((issue) => issue.code === 'DIFFICULTY_COUNT_MISMATCH')).toBe(true);
  });
});
