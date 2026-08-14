import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import type { RandomizationPolicy } from '../shared/randomization-policy.contract';

const mocks = vi.hoisted(() => ({
  policy: {
    enabled: true,
    shuffleQuestions: true,
    shuffleChoices: true,
    shuffleMatching: true,
    shuffleOrdering: true,
    shuffleDragDrop: true,
    shufflePractice: true,
  } as RandomizationPolicy,
  rendererPolicies: [] as Array<RandomizationPolicy | undefined>,
  updateActivity: vi.fn(async () => undefined),
}));

vi.mock('../src/features/randomization/useRandomizationPolicy', () => ({
  useRandomizationPolicy: () => mocks.policy,
}));

vi.mock('../src/hooks', () => ({
  useLiveExamTimer: () => ({ timeRemaining: 600, isExpired: false }),
  useLiveExamActivity: () => ({ updateActivity: mocks.updateActivity }),
}));

vi.mock('../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: true }),
}));

vi.mock('../src/services/liveExamService', () => ({
  getAnswerSnapshot: vi.fn(async () => null),
  saveAnswerSnapshot: vi.fn(async (_sessionId, payload) => ({
    attemptVersion: payload.attemptVersion,
    answers: payload.answers,
    updatedAt: '2026-08-14T00:00:00.000Z',
  })),
  submitAnswers: vi.fn(),
}));

vi.mock('../src/features/live-exam/liveExamAutosaveQueue', () => ({
  createLiveExamAutosaveQueue: () => ({
    dispose: vi.fn(),
    setOnline: vi.fn(),
    enqueue: vi.fn(),
  }),
}));

vi.mock('../src/components/student/QuestionRenderer', () => ({
  default: ({ randomizationPolicy }: { randomizationPolicy?: RandomizationPolicy }) => {
    mocks.rendererPolicies.push(randomizationPolicy);
    return <div data-testid="live-renderer">Câu live</div>;
  },
}));

vi.mock('../src/features/quiz-player/components/QuizHeader', () => ({ default: () => null }));
vi.mock('../src/features/quiz-player/components/QuizNavigation', () => ({ default: () => null }));
vi.mock('../src/features/quiz-player/components/QuizPagination', () => ({ default: () => null }));
vi.mock('../src/features/quiz-player/components/MobileQuizNavigator', () => ({ default: () => null }));
vi.mock('../src/components/student', () => ({ SubmitConfirmModal: () => null }));

import { LiveExamQuiz } from '../src/components/LiveExam/LiveExamQuiz';

const question = {
  id: 'live-randomization-1',
  type: 'MATCHING',
  question: 'Nối',
  leftItems: ['A', 'B'],
  rightItems: ['1', '2'],
} as unknown as Question;

const renderQuiz = () => render(
  <LiveExamQuiz
    sessionId="session-randomization"
    questions={[question]}
    quizTitle="Thi thử"
    duration={60}
    endsAt="2099-01-01T00:00:00.000Z"
    onComplete={vi.fn()}
  />,
);

describe('LiveExamQuiz randomization policy', () => {
  beforeEach(() => {
    mocks.rendererPolicies.length = 0;
    mocks.updateActivity.mockClear();
    window.sessionStorage.clear();
    mocks.policy = {
      enabled: true,
      shuffleQuestions: true,
      shuffleChoices: true,
      shuffleMatching: true,
      shuffleOrdering: true,
      shuffleDragDrop: true,
      shufflePractice: true,
    };
  });

  it('keeps live-exam question and A/B/C/D order fixed while forwarding structured randomization flags', () => {
    renderQuiz();

    expect(screen.getByTestId('live-renderer')).toBeInTheDocument();
    expect(mocks.rendererPolicies.at(-1)).toEqual({
      enabled: true,
      shuffleQuestions: false,
      shuffleChoices: false,
      shuffleMatching: true,
      shuffleOrdering: true,
      shuffleDragDrop: true,
      shufflePractice: true,
    });
  });

  it('forwards a fully disabled effective policy when the admin master switch is off', () => {
    mocks.policy = {
      enabled: false,
      shuffleQuestions: false,
      shuffleChoices: false,
      shuffleMatching: false,
      shuffleOrdering: false,
      shuffleDragDrop: false,
      shufflePractice: false,
    };

    renderQuiz();

    expect(mocks.rendererPolicies.at(-1)).toEqual(mocks.policy);
  });
});
