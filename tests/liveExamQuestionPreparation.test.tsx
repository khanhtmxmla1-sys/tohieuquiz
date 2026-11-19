import { render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getLiveExamQuestionsMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/liveExamService', () => ({
  getLiveExamQuestions: getLiveExamQuestionsMock,
}));

import { useLiveExamQuizPreparation } from '../src/features/student-dashboard/hooks/useLiveExamQuizPreparation';
import { useQuizStore } from '../stores/quizStore';

const quiz = {
  id: 'quiz-1',
  title: 'Thi trực tiếp',
  classLevel: '4',
  timeLimit: 30,
  questions: [],
  createdAt: '2026-11-19T00:00:00.000Z',
};

const studentQuestion = (id: string) => ({
  id,
  type: 'MATCHING',
  question: 'Nối',
  leftItems: [{ id: `${id}_left`, content: 'A' }],
  rightItems: [{ id: `${id}_right`, content: 'X' }],
});

describe('useLiveExamQuizPreparation', () => {
  beforeEach(() => {
    getLiveExamQuestionsMock.mockReset();
    useQuizStore.setState({
      quizzes: [quiz],
      loadQuizQuestions: vi.fn(async () => null),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads participant-scoped questions for the active session, not the quiz catalogue', async () => {
    getLiveExamQuestionsMock.mockResolvedValue({
      sessionId: 'session-1',
      quizId: 'quiz-1',
      revision: 3,
      questions: [{
        id: 'question-1',
        type: 'MATCHING',
        question: 'Nối',
        leftItems: [{ id: 'sq1_left', content: 'A' }],
        rightItems: [{ id: 'sq1_right', content: 'X' }],
      }],
    });

    const { result } = renderHook(() => useLiveExamQuizPreparation(
      {
        sessionId: 'session-1',
        sessionTitle: 'Thi trực tiếp',
        quizId: 'quiz-1',
        duration: 30,
      },
      quiz as any,
      'active',
    ));

    await waitFor(() => expect(getLiveExamQuestionsMock).toHaveBeenCalledWith('session-1'));

    expect(useQuizStore.getState().loadQuizQuestions).not.toHaveBeenCalled();
    expect(useQuizStore.getState().quizzes[0].questions[0]).toMatchObject({
      id: 'question-1',
      type: 'MATCHING',
      leftItems: [{ id: 'sq1_left' }],
      rightItems: [{ id: 'sq1_right' }],
    });
    expect(JSON.stringify(useQuizStore.getState().quizzes[0].questions))
      .not.toMatch(/"(?:correct_answer|correctAnswer|correctAnswers|correctWordIndexes|correctOrder|wrongWord|categoryId|pairs|explanation)"\s*:/);
    expect(result.current.loadError).toBeNull();
  });

  it('refetches after an active session resumes if its scoped questions were cleared', async () => {
    getLiveExamQuestionsMock.mockResolvedValue({
      sessionId: 'session-1',
      quizId: 'quiz-1',
      revision: 3,
      questions: [{
        id: 'question-1',
        type: 'MATCHING',
        question: 'Nối',
        leftItems: [{ id: 'sq1_left', content: 'A' }],
        rightItems: [{ id: 'sq1_right', content: 'X' }],
      }],
    });

    let stage: 'active' | 'waiting' = 'active';
    const joinedExam = {
      sessionId: 'session-1',
      sessionTitle: 'Thi trực tiếp',
      quizId: 'quiz-1',
      duration: 30,
    };
    const { rerender } = renderHook(() => useLiveExamQuizPreparation(
      joinedExam,
      quiz as any,
      stage,
    ));

    await waitFor(() => expect(getLiveExamQuestionsMock).toHaveBeenCalledTimes(1));

    stage = 'waiting';
    rerender();
    useQuizStore.setState((state) => ({
      quizzes: state.quizzes.map((item) => ({ ...item, questions: [] })),
    }));
    stage = 'active';
    rerender();

    await waitFor(() => expect(getLiveExamQuestionsMock).toHaveBeenCalledTimes(2));
  });

  it('keeps catalog questions out of the render-ready state until the scoped response resolves', async () => {
    let resolveResponse!: (value: unknown) => void;
    getLiveExamQuestionsMock.mockReturnValue(new Promise((resolve) => {
      resolveResponse = resolve;
    }));
    const unsafeQuiz = {
      ...quiz,
      questions: [{ ...studentQuestion('catalog'), correctAnswer: 'A', pairs: [{ left: 'A', right: 'X' }] }],
    };
    useQuizStore.setState({ quizzes: [unsafeQuiz] } as any);

    const snapshots: boolean[] = [];
    const Harness = () => {
      const currentQuiz = useQuizStore((state) => state.quizzes[0] || null);
      const preparation = useLiveExamQuizPreparation(
        { sessionId: 'session-gated', sessionTitle: 'Thi trực tiếp', quizId: 'quiz-1', duration: 30 },
        currentQuiz as any,
        'active',
      );
      snapshots.push(preparation.isPreparing);
      return null;
    };
    render(<Harness />);

    expect(snapshots[0]).toBe(true);
    resolveResponse({
      sessionId: 'session-gated',
      quizId: 'quiz-1',
      revision: 3,
      questions: [studentQuestion('scoped')],
    });
    await waitFor(() => expect(useQuizStore.getState().quizzes[0].questions[0]?.id).toBe('scoped'));
    expect(snapshots.at(-1)).toBe(false);
    expect(useQuizStore.getState().quizzes[0].questions[0].id).toBe('scoped');
  });

  it('re-gates immediately when the active session changes', async () => {
    let activeSession = 'session-one';
    let resolveSecondResponse!: (value: unknown) => void;
    getLiveExamQuestionsMock.mockImplementation((sessionId: string) => {
      if (sessionId === 'session-one') {
        return Promise.resolve({
          sessionId: 'session-one',
          quizId: 'quiz-1',
          revision: 3,
          questions: [studentQuestion('one')],
        });
      }
      return new Promise((resolve) => {
        resolveSecondResponse = resolve;
      });
    });

    const { result, rerender } = renderHook(() => {
      const currentQuiz = useQuizStore((state) => state.quizzes[0] || null);
      return useLiveExamQuizPreparation(
        { sessionId: activeSession, sessionTitle: 'Thi trực tiếp', quizId: 'quiz-1', duration: 30 },
        currentQuiz as any,
        'active',
      );
    });

    await waitFor(() => expect(getLiveExamQuestionsMock).toHaveBeenCalledWith('session-one'));
    await waitFor(() => expect(useQuizStore.getState().quizzes[0].questions[0]?.id).toBe('one'));
    expect(result.current.isPreparing).toBe(false);
    activeSession = 'session-two';
    rerender();
    expect(result.current.isPreparing).toBe(true);

    resolveSecondResponse({
      sessionId: 'session-two',
      quizId: 'quiz-1',
      revision: 3,
      questions: [studentQuestion('two')],
    });
    await waitFor(() => expect(result.current.isPreparing).toBe(false));
    expect(getLiveExamQuestionsMock).toHaveBeenLastCalledWith('session-two');
  });
});
