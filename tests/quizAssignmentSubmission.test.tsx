import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';

const mocks = vi.hoisted(() => ({
  validateAnswersOnServer: vi.fn(),
  calculateStudentScore: vi.fn(),
  onSaveResult: vi.fn(),
  trackQuizActivity: vi.fn(),
}));

vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({
    studentSession: {
      studentId: 'student-1', username: 'student-1', fullName: 'Nguyen Van A',
      className: '4A9', avatar: '',
    },
  }),
}));
vi.mock('../src/stores/useGamificationStore', () => ({
  useGamificationStore: { getState: () => ({ pet: null }) },
}));
vi.mock('../src/stores/useGameLoopStore', () => ({
  useGameLoopStore: { getState: () => ({ trackQuizActivity: mocks.trackQuizActivity }) },
}));
vi.mock('../src/services/quizValidationService', () => ({
  validateAnswersOnServer: mocks.validateAnswersOnServer,
}));
vi.mock('../src/features/quiz-player/utils/quizScoring', () => ({
  calculateStudentScore: mocks.calculateStudentScore,
}));
vi.mock('../src/utils/toast', () => ({
  playTingSound: vi.fn(),
  showError: vi.fn(),
}));

import { useQuizPlayer } from '../src/features/quiz-player/hooks/useQuizPlayer';

const quiz = {
  id: 'quiz-week-30',
  title: 'Week 30',
  classLevel: '4',
  category: 'class',
  timeLimit: 0,
  createdAt: '2026-07-20T00:00:00.000Z',
  questions: [{
    id: 'q1', quizId: 'quiz-week-30', type: QuestionType.MULTIPLE_CHOICE,
    question: '1 + 1?', options: ['1', '2'], correctAnswer: 'B',
  }],
  _assignmentData: { id: 'assignment-current-3-attempts', maxAttempts: 3, attemptCount: 1 },
} as unknown as Quiz;

describe('assigned quiz result payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateAnswersOnServer.mockResolvedValue({
      success: true,
      details: [{ questionId: 'q1', isCorrect: true }],
    });
    mocks.calculateStudentScore.mockReturnValue({
      score: 10,
      correctCount: 1,
      details: [{ questionId: 'q1', isCorrect: true }],
    });
    mocks.onSaveResult.mockImplementation(async (result: StudentResult) => result);
  });

  it('includes the active assignment id when submitting the result', async () => {
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await waitFor(() => expect(result.current.step).toBe('quiz'));
    act(() => result.current.handleAnswerChange('q1', 'B'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.onSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      quizId: 'quiz-week-30',
      assignmentId: 'assignment-current-3-attempts',
    }));
  });
});
