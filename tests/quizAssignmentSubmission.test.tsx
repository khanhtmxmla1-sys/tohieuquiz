import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Quiz, type StudentResult } from '../src/types';

const mocks = vi.hoisted(() => ({
  validateAnswersOnServer: vi.fn(),
  calculateStudentScore: vi.fn(),
  onSaveResult: vi.fn(),
  trackQuizActivity: vi.fn(),
  startAssignmentAttempt: vi.fn(),
  fetchQuizPlayQuestions: vi.fn(),
  requestQuizAccess: vi.fn(),
  adaptStudentQuizQuestion: vi.fn((question: unknown) => question),
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
vi.mock('../src/services/classroomService', () => ({
  startAssignmentAttempt: mocks.startAssignmentAttempt,
}));
vi.mock('../src/services/quizAccessService', () => ({
  fetchQuizPlayQuestions: mocks.fetchQuizPlayQuestions,
  requestQuizAccess: mocks.requestQuizAccess,
  adaptStudentQuizQuestion: mocks.adaptStudentQuizQuestion,
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
    mocks.startAssignmentAttempt.mockResolvedValue({
      assignmentId: 'assignment-current-3-attempts',
      attemptCount: 1,
      maxAttempts: 3,
      remainingAttempts: 2,
      deadline: '2099-01-01T00:00:00.000Z',
      status: 'OPEN',
    });
    mocks.fetchQuizPlayQuestions.mockResolvedValue({
      quizId: 'quiz-week-30',
      revision: 1,
      questions: quiz.questions,
    });
  });

  it('includes the active assignment id when submitting the result', async () => {
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await act(async () => {
      await result.current.handleStart();
    });
    expect(result.current.step).toBe('quiz');
    act(() => result.current.handleAnswerChange('q1', 'B'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.validateAnswersOnServer).not.toHaveBeenCalled();
    expect(mocks.onSaveResult).toHaveBeenCalledWith(expect.objectContaining({
      quizId: 'quiz-week-30',
      assignmentId: 'assignment-current-3-attempts',
      answers: { q1: 'B', _questionOrder: ['q1'] },
    }), expect.objectContaining({ accessGrant: undefined }));
  });

  it('passes the access grant only through the ephemeral submit context', async () => {
    const codeQuiz = {
      ...quiz,
      id: 'quiz-code-submit',
      requireCode: true,
      _assignmentData: undefined,
    } as unknown as Quiz;
    mocks.requestQuizAccess.mockResolvedValue({ valid: true, accessGrant: 'grant-memory-only' });
    mocks.fetchQuizPlayQuestions.mockResolvedValue({
      quizId: codeQuiz.id,
      revision: 1,
      questions: codeQuiz.questions,
    });

    const { result } = renderHook(() => useQuizPlayer({
      quiz: codeQuiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    act(() => result.current.setEnteredCode('abc123'));
    await act(async () => result.current.handleCodeVerify());
    await act(async () => result.current.handleStart());
    act(() => result.current.handleAnswerChange('q1', 'B'));
    await act(async () => result.current.handleSubmit());

    expect(mocks.onSaveResult).toHaveBeenCalledWith(
      expect.anything(),
      { accessGrant: 'grant-memory-only' },
    );
    expect(JSON.stringify(mocks.onSaveResult.mock.calls[0][0])).not.toContain('grant-memory-only');
  });

  it('renders the authoritative saved result returned by the Worker adapter', async () => {
    const authoritativeResult: StudentResult = {
      id: 'server-result-99',
      quizId: quiz.id,
      assignmentId: 'assignment-current-3-attempts',
      quizTitle: quiz.title,
      studentName: 'Nguyen Van A',
      studentClass: '4A9',
      score: 7.5,
      correctCount: 3,
      questionCount: 4,
      totalQuestions: 4,
      voidedCount: 0,
      timeTaken: 1.25,
      submittedAt: '2026-11-20T01:00:00.000Z',
      answers: { q1: { selectedAnswer: 'B', isCorrect: false }, _questionOrder: ['q1'] },
      validationDetails: [{ questionId: 'q1', isCorrect: false, status: 'wrong' }],
      reviewDetails: [],
      gradingVersion: '2.0.0',
    };
    mocks.onSaveResult.mockResolvedValue(authoritativeResult);
    const { result } = renderHook(() => useQuizPlayer({
      quiz,
      onExit: vi.fn(),
      onSaveResult: mocks.onSaveResult,
    }));

    await act(async () => result.current.handleStart());
    await act(async () => result.current.handleSubmit());

    expect(result.current.result).toEqual(authoritativeResult);
    expect(result.current.rewardData).toMatchObject({
      resultId: 'server-result-99',
      score: 7.5,
      correctCount: 3,
      totalQuestions: 4,
    });
  });
});
