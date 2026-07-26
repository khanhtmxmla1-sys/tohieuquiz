import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  buildQuizRepairPrompt,
  mergeRepairedQuestions,
} from '../src/services/ai/quizRepair';
import { parseGeneratedQuiz } from '../src/services/ai/schemas/quizGenerationSchema';
import type { QuizAuditIssue } from '../src/services/ai/quizAudit';
import type { QuizBlueprint } from '../src/features/quiz-generator/domain/quizBlueprint';

const makeMcq = (index: number, id = `q-${index}`) => ({
  id,
  type: QuestionType.MCQ,
  question: `Câu hỏi duy nhất số ${index}`,
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 'A',
  explanation: `Giải thích câu ${index}.`,
  difficultyLevel: 2,
});

const blueprint: QuizBlueprint = {
  intent: 'EXAM',
  sourceMode: 'TOPIC',
  totalQuestions: 10,
  typeAllocations: [{ type: QuestionType.MCQ, count: 10 }],
  difficultyLevels: { level1: 0, level2: 10, level3: 0 },
};

describe('targeted quiz repair', () => {
  it('requests exactly the two missing questions', () => {
    const eightQuestionQuiz = parseGeneratedQuiz({
      title: 'Đề 8 câu',
      questions: Array.from({ length: 8 }, (_, index) => makeMcq(index)),
    });
    const missingTwoIssues: QuizAuditIssue[] = [{
      code: 'QUESTION_COUNT_MISMATCH',
      questionIndexes: [],
      message: 'Thiếu 2 câu.',
      repairable: true,
    }];

    const prompt = buildQuizRepairPrompt({
      blueprint,
      quiz: eightQuestionQuiz,
      issues: missingTwoIssues,
    });

    expect(prompt).toContain('Tạo đúng 2 câu thay thế');
    expect(prompt).not.toContain(JSON.stringify(eightQuestionQuiz.questions));
  });

  it('replaces only invalid indexes and keeps valid question ids', () => {
    const original = parseGeneratedQuiz({
      title: 'Đề gốc',
      questions: Array.from({ length: 5 }, (_, index) => makeMcq(index)),
    });
    const repaired = parseGeneratedQuiz({
      title: 'Phần sửa',
      questions: [{
        ...makeMcq(99, 'new-id'),
        question: 'Câu thay thế hợp lệ',
      }],
    });
    const issues: QuizAuditIssue[] = [{
      code: 'INVALID_ANSWER',
      questionIndexes: [3],
      message: 'Đáp án sai.',
      repairable: true,
    }];

    const merged = mergeRepairedQuestions(original, repaired, issues);

    expect(merged.questions[0]).toBe(original.questions[0]);
    expect(merged.questions[3].id).toBe(original.questions[3].id);
    expect(merged.questions[3].question).toBe('Câu thay thế hợp lệ');
  });
});
