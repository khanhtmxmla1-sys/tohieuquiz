import { describe, expect, it } from 'vitest';
import { calculateOverrideFromAnswers } from '../src/components/TeacherDashboard/results-tab/resultAnswerOverride';
import type { Quiz, StudentResult } from '../src/types';

const createResult = (): StudentResult => ({
  id: 'result-1',
  quizId: 'quiz-1',
  studentName: 'Quang Minh Ngoc',
  studentClass: '4A9',
  score: 0,
  correctCount: 0,
  totalQuestions: 10,
  timeTaken: 11,
  submittedAt: '2026-07-19T20:35:00.000Z',
  answers: {},
});

const createQuiz = (): Quiz => ({
  id: 'quiz-1',
  title: 'Phep cong phan so khac mau so',
  classLevel: '4',
  timeLimit: 15,
  createdAt: '2026-07-19T00:00:00.000Z',
  questions: Array.from({ length: 10 }, (_, index) => ({
    id: `q${index + 1}`,
    type: 'MCQ',
    question: `Question ${index + 1}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'C',
  })) as Quiz['questions'],
});

describe('calculateOverrideFromAnswers', () => {
  it('recalculates a legacy result from plain answers and quiz questions', () => {
    const answers = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`q${index + 1}`, index === 6 ? 'A' : 'C']),
    );

    expect(calculateOverrideFromAnswers(createResult(), answers, createQuiz())).toEqual({
      correctCount: 9,
      totalQuestions: 10,
      score: 9,
    });
  });

  it('keeps canonical stored grading when sanitized snapshots omit answer keys', () => {
    const answers = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `q${index + 1}`,
        {
          selectedAnswer: index === 7 ? undefined : index % 2 === 0 ? 'C' : 'A',
          isCorrect: index < 5,
          questionSnapshot: {
            id: `q${index + 1}`,
            type: 'MCQ',
            question: `Question ${index + 1}`,
            options: ['A', 'B', 'C', 'D'],
          },
        },
      ]),
    );

    expect(calculateOverrideFromAnswers({
      ...createResult(),
      score: 5,
      correctCount: 5,
      gradingVersion: '2.0.0',
    }, answers)).toEqual({
      correctCount: 5,
      totalQuestions: 10,
      score: 5,
    });
  });

  it('preserves canonical voided denominators instead of using current quiz length', () => {
    const canonical = {
      ...createResult(),
      gradingVersion: '2.0.0',
      score: 10,
      correctCount: 2,
      totalQuestions: 2,
      voidedCount: 1,
    };
    const answers = {
      q1: { selectedAnswer: 'C', isCorrect: true, status: 'correct', gradingVersion: '2.0.0' },
      q2: { selectedAnswer: 'C', isCorrect: true, status: 'correct', gradingVersion: '2.0.0' },
      q3: { selectedAnswer: 'A', isCorrect: false, status: 'voided', gradingVersion: '2.0.0' },
    };

    expect(calculateOverrideFromAnswers(canonical, answers, createQuiz())).toEqual({
      score: 10,
      correctCount: 2,
      totalQuestions: 2,
    });
  });

  it('preserves canonical all-voided 0/0 metrics', () => {
    expect(calculateOverrideFromAnswers({
      ...createResult(),
      gradingVersion: '2.0.0',
      score: 0,
      correctCount: 0,
      totalQuestions: 0,
      voidedCount: 3,
    }, {
      q1: { status: 'voided', isCorrect: false, gradingVersion: '2.0.0' },
    }, createQuiz())).toEqual({ score: 0, correctCount: 0, totalQuestions: 0 });
  });

  it('treats a canonical answer envelope as authoritative even if the result lacks gradingVersion', () => {
    expect(calculateOverrideFromAnswers({
      ...createResult(),
      score: 7.5,
      correctCount: 3,
      totalQuestions: 4,
    }, {
      q1: { selectedAnswer: 'A', isCorrect: false, status: 'wrong', gradingVersion: '2.0.0' },
    }, createQuiz())).toEqual({ score: 7.5, correctCount: 3, totalQuestions: 4 });
  });

  it('uses the quiz question when a saved answer has no question snapshot', () => {
    const answers = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `q${index + 1}`,
        { selectedAnswer: index === 6 ? 'A' : 'C' },
      ]),
    );

    expect(calculateOverrideFromAnswers(createResult(), answers, createQuiz())).toMatchObject({
      correctCount: 9,
      totalQuestions: 10,
      score: 9,
    });
  });
});
