import { describe, expect, it } from 'vitest';
import {
  AiTutorDiagnoseRequestSchema,
  AiTutorPracticeQuestionSchema,
  AiTutorProviderOutputSchema,
} from '../shared/ai-tutor.contract';

describe('AI Tutor contract', () => {
  it('accepts only a resultId request', () => {
    expect(AiTutorDiagnoseRequestSchema.parse({ resultId: 'result-1' })).toEqual({ resultId: 'result-1' });
    expect(() => AiTutorDiagnoseRequestSchema.parse({ quizId: 'quiz-1', wrongQuestionIds: ['q1'] })).toThrow();
  });

  it('requires four options and a correct answer contained in options', () => {
    const valid = {
      id: 'practice-1',
      question: '2 + 2 bằng bao nhiêu?',
      options: ['2', '3', '4', '5'],
      correctAnswer: '4',
    };
    expect(AiTutorPracticeQuestionSchema.parse(valid)).toEqual(valid);
    expect(() => AiTutorPracticeQuestionSchema.parse({ ...valid, correctAnswer: '6' })).toThrow();
  });

  it('limits provider output to two or three practice questions', () => {
    const question = {
      question: 'Chọn đáp án đúng.',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
    };
    expect(AiTutorProviderOutputSchema.parse({ diagnosis: 'Cần luyện thêm.', practiceQuestions: [question, question] })).toBeTruthy();
    expect(() => AiTutorProviderOutputSchema.parse({ diagnosis: 'Cần luyện thêm.', practiceQuestions: [question] })).toThrow();
  });
});
