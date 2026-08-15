// @vitest-environment jsdom
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchResultAnswerReview: vi.fn(),
}));

vi.mock('../src/services/results/resultAnswersService', () => ({
  fetchResultAnswerReview: mocks.fetchResultAnswerReview,
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
});
