// @vitest-environment jsdom
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchResultAnswerReview: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../src/services/results/resultAnswersService', () => ({
  fetchResultAnswerReview: mocks.fetchResultAnswerReview,
}));

vi.mock('../src/utils/toast', () => ({
  showError: mocks.showError,
}));

import { useStudentAssignments } from '../src/features/student-dashboard/hooks/useStudentAssignments';
import { useAssignmentStore } from '../src/stores/useAssignmentStore';
import { useQuizStore } from '../stores/quizStore';

const quiz = {
  id: 'quiz-1',
  title: 'Phân số',
  questions: [{ id: 'q1', question: '1/2 + 1/2?', options: ['0', '1'], correctAnswer: '1' }],
  duration: 10,
  timeLimit: 10,
  requireCode: false,
  allowReview: true,
  classLevel: '4',
  subject: 'toan',
  category: 'class',
  createdAt: '2026-08-01T00:00:00.000Z',
  maxScore: 10,
} as any;

const assignment = (id: string) => ({
  id,
  quizId: quiz.id,
  quizTitle: quiz.title,
  classId: 'class-4a',
  studentId: 'student-1',
  deadline: '2026-08-30T00:00:00.000Z',
  status: 'OPEN',
  maxAttempts: 1,
  attemptCount: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
}) as any;

const resultRow = (id: string, assignmentId: string, submittedAt: string) => ({
  id,
  quizId: quiz.id,
  assignmentId,
  studentId: 'student-1',
  studentName: 'An',
  score: 10,
  totalQuestions: 1,
  correctCount: 1,
  timeTaken: 30,
  submittedAt,
  answers: {},
}) as any;

describe('useStudentAssignments review integrity', () => {
  beforeEach(() => {
    mocks.fetchResultAnswerReview.mockReset();
    mocks.fetchResultAnswerReview.mockResolvedValue({
      answers: {
        _questionOrder: ['q1'],
        q1: {
          selectedAnswer: '1',
          questionSnapshot: quiz.questions[0],
        },
      },
      reviewDetails: [],
    });

    useAssignmentStore.setState({
      assignments: [assignment('assignment-A'), assignment('assignment-B')],
      isLoading: false,
      error: null,
    });
    useQuizStore.setState({
      quizzes: [quiz],
      results: [
        resultRow('result-A', 'assignment-A', '2026-08-10T08:00:00.000Z'),
        resultRow('result-B', 'assignment-B', '2026-08-11T08:00:00.000Z'),
      ],
      loadResults: vi.fn(async () => undefined),
      loadQuizQuestions: vi.fn(async () => quiz),
    } as any);
  });

  it('reviews the result for the selected assignment even when a sibling assignment is newer', async () => {
    const { result } = renderHook(() => useStudentAssignments(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/student/assignments']}>{children}</MemoryRouter>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const assignmentA = result.current.pagedQuizzes.find(
      (item) => item._assignmentData?.id === 'assignment-A',
    );
    expect(assignmentA).toBeTruthy();

    await act(async () => {
      await result.current.reviewQuiz(assignmentA!);
    });

    expect(mocks.fetchResultAnswerReview).toHaveBeenCalledWith('result-A');
    expect(result.current.reviewState?.result.id).toBe('result-A');
  });

  it('opens the newest attempt for the selected assignment, not the newest result globally', async () => {
    useQuizStore.setState({
      results: [
        resultRow('result-A-first', 'assignment-A', '2026-08-10T08:00:00.000Z'),
        resultRow('result-A-latest', 'assignment-A', '2026-08-12T08:00:00.000Z'),
        resultRow('result-B-latest', 'assignment-B', '2026-08-13T08:00:00.000Z'),
      ],
    } as any);
    mocks.fetchResultAnswerReview.mockImplementation(async (resultId: string) => ({
      answers: {
        _questionOrder: ['q1'],
        q1: {
          selectedAnswer: resultId === 'result-A-latest' ? '1' : '0',
          questionSnapshot: quiz.questions[0],
        },
      },
      reviewDetails: [],
    }));

    const { result } = renderHook(() => useStudentAssignments(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/student/assignments']}>{children}</MemoryRouter>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const assignmentA = result.current.pagedQuizzes.find(
      (item) => item._assignmentData?.id === 'assignment-A',
    );
    expect(assignmentA).toBeTruthy();

    await act(async () => {
      await result.current.reviewQuiz(assignmentA!);
    });

    expect(mocks.fetchResultAnswerReview).toHaveBeenCalledWith('result-A-latest');
    expect(result.current.reviewState?.result.id).toBe('result-A-latest');
    expect(result.current.reviewState?.answers.q1).toBe('1');
  });

  it('replaces the previous review state when a different assignment is opened', async () => {
    mocks.fetchResultAnswerReview.mockImplementation(async (resultId: string) => ({
      answers: {
        _questionOrder: ['q1'],
        q1: {
          selectedAnswer: resultId === 'result-A' ? 'A-answer' : 'B-answer',
          questionSnapshot: quiz.questions[0],
        },
      },
      reviewDetails: [{
        questionId: 'q1',
        type: 'MCQ',
        status: resultId === 'result-A' ? 'wrong' : 'correct',
        isCorrect: resultId !== 'result-A',
      }],
    }));

    const { result } = renderHook(() => useStudentAssignments(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/student/assignments']}>{children}</MemoryRouter>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const assignmentA = result.current.pagedQuizzes.find(
      (item) => item._assignmentData?.id === 'assignment-A',
    );
    const assignmentB = result.current.pagedQuizzes.find(
      (item) => item._assignmentData?.id === 'assignment-B',
    );
    expect(assignmentA).toBeTruthy();
    expect(assignmentB).toBeTruthy();

    await act(async () => {
      await result.current.reviewQuiz(assignmentA!);
    });
    expect(result.current.reviewState?.result.id).toBe('result-A');

    await act(async () => {
      await result.current.reviewQuiz(assignmentB!);
    });

    expect(result.current.reviewState?.result.id).toBe('result-B');
    expect(result.current.reviewState?.answers.q1).toBe('B-answer');
    expect(result.current.reviewState?.result.reviewDetails?.[0]).toMatchObject({
      status: 'correct',
      isCorrect: true,
    });
  });

  it('clears the loading marker after a result-answer fetch failure so the dashboard can retry', async () => {
    mocks.fetchResultAnswerReview
      .mockRejectedValueOnce(new Error('Không thể tải bài làm'))
      .mockResolvedValueOnce({
        answers: {
          _questionOrder: ['q1'],
          q1: {
            selectedAnswer: '1',
            questionSnapshot: quiz.questions[0],
          },
        },
        reviewDetails: [],
      });

    const { result } = renderHook(() => useStudentAssignments(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/student/assignments']}>{children}</MemoryRouter>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const assignmentA = result.current.pagedQuizzes.find(
      (item) => item._assignmentData?.id === 'assignment-A',
    );
    expect(assignmentA).toBeTruthy();

    await act(async () => {
      await result.current.reviewQuiz(assignmentA!);
    });

    expect(mocks.showError).toHaveBeenCalledWith('Không thể tải bài làm');
    expect(result.current.reviewingAssignmentId).toBeNull();
    expect(result.current.reviewState).toBeNull();

    await act(async () => {
      await result.current.reviewQuiz(assignmentA!);
    });

    expect(mocks.fetchResultAnswerReview).toHaveBeenLastCalledWith('result-A');
    expect(result.current.reviewState?.result.id).toBe('result-A');
  });
});
