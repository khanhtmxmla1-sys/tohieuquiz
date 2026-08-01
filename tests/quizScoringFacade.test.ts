import { describe, expect, it } from 'vitest';
import { calculateStudentScore } from '../src/features/quiz-player/utils/quizScoring';

describe('legacy calculateStudentScore facade', () => {
  it('delegates dropdown legacy keys to the canonical engine', () => {
    const quiz = {
      id: 'quiz-a',
      title: 'Quiz',
      classLevel: '4',
      timeLimit: 10,
      createdAt: '',
      createdBy: '',
      questions: [{
        id: 'drop',
        type: 'DROPDOWN',
        question: 'Chọn',
        text: '[blank_0]',
        blanks: [{ id: 'blank_0', options: ['x', 'y'], correctAnswer: 'x' }],
      }],
    } as any;

    expect(calculateStudentScore(quiz, { drop: { 0: 'x' } })).toMatchObject({
      score: 10,
      correctCount: 1,
      totalItems: 1,
      details: [expect.objectContaining({ questionId: 'drop', isCorrect: true })],
    });
  });

  it('preserves the public facade shape while ignoring client correctness metadata', () => {
    const quiz = {
      id: 'quiz-a', title: 'Quiz', classLevel: '4', timeLimit: 10, createdAt: '', createdBy: '',
      questions: [{ id: 'q1', type: 'MCQ', question: '2+2?', options: ['4', '5'], correctAnswer: 'A' }],
    } as any;
    const result = calculateStudentScore(quiz, {
      q1: { selectedAnswer: 'B', isCorrect: true, questionSnapshot: { correctAnswer: 'B' } },
    });
    expect(result).toEqual({
      score: 0,
      correctCount: 0,
      totalItems: 1,
      details: [{ questionId: 'q1', isCorrect: false, correctAnswer: 'A' }],
    });
  });
});
