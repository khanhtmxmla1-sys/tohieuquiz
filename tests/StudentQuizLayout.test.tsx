import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question, Quiz } from '../src/types';
import StudentView from '../src/components/StudentView';

const mocks = vi.hoisted(() => ({
  setShowSubmitConfirm: vi.fn(),
  changePage: vi.fn(),
  useQuizPlayerArgs: vi.fn(),
  questionPolicy: vi.fn(),
  policy: {
    enabled: false, shuffleQuestions: false, shuffleChoices: false, shuffleMatching: false,
    shuffleOrdering: false, shuffleDragDrop: false, randomizePracticeSelection: false,
  },
}));

const question = {
  id: 'q-1',
  type: 'MCQ',
  question: 'Câu hỏi kiểm thử',
  options: ['A', 'B'],
} as unknown as Question;

vi.mock('../src/features/quiz-player/hooks/useQuizPlayer', () => ({
  useQuizPlayer: (args: unknown) => {
    mocks.useQuizPlayerArgs(args);
    return ({
    step: 'quiz',
    studentName: 'An',
    setStudentName: vi.fn(),
    studentClass: '4A1',
    setStudentClass: vi.fn(),
    studentAvatar: 'https://assets.example.test/an.png',
    enteredCode: '',
    setEnteredCode: vi.fn(),
    codeError: '',
    isVerifyingCode: false,
    answers: {},
    timeLeft: 600,
    result: null,
    shuffledQuestions: [question],
    isStarting: false,
    startError: '',
    isSubmitting: false,
    submitError: '',
    showReward: false,
    setShowReward: vi.fn(),
    showSubmitConfirm: false,
    setShowSubmitConfirm: mocks.setShowSubmitConfirm,
    rewardData: null,
    currentPage: 1,
    setCurrentPage: vi.fn(),
    totalPages: 1,
    questionsOnCurrentPage: [question],
    quizProgress: {
      byQuestionId: {},
      completeCount: 0,
      partialCount: 0,
      emptyCount: 1,
    },
    handleStart: vi.fn(),
    handleCodeVerify: vi.fn(),
    handleAnswerChange: vi.fn(),
    handleMatchingClick: vi.fn(),
    handleSubmit: vi.fn(),
    handleRetryReward: vi.fn(),
  });
  },
}));



vi.mock('../src/features/randomization/useRandomizationPolicy', () => ({
  useRandomizationPolicy: () => mocks.policy,
}));

vi.mock('../src/features/quiz-player/hooks/useQuizPageNavigation', () => ({
  useQuizPageNavigation: () => ({
    activeQuestionId: 'q-1',
    changePage: mocks.changePage,
  }),
}));

vi.mock('../src/components/student', () => ({
  AccessCodeForm: () => null,
  StudentInfoForm: () => null,
  QuizStartNotice: () => null,
  SubmitConfirmModal: () => null,
  ResultScreen: () => null,
  QuestionRenderer: ({ index, randomizationPolicy }: { index: number; randomizationPolicy?: unknown }) => {
    mocks.questionPolicy(randomizationPolicy);
    return <div>Câu hiển thị {index + 1}</div>;
  },
}));

const quiz = {
  id: 'quiz-layout',
  title: 'Bài kiểm tra bố cục',
  questions: [question],
  isPractice: false,
} as unknown as Quiz;

describe('StudentView desktop quiz layout', () => {
  beforeEach(() => {
    mocks.setShowSubmitConfirm.mockReset();
    mocks.changePage.mockReset();
    mocks.useQuizPlayerArgs.mockReset();
    mocks.questionPolicy.mockReset();
  });

  it('keeps the desktop controls stationary and makes only the question column scrollable', () => {
    const { container } = render(
      <StudentView quiz={quiz} onExit={vi.fn()} onSaveResult={vi.fn()} />,
    );

    const shell = container.querySelector('.student-quiz-shell');
    expect(shell).toHaveClass('lg:h-dvh', 'lg:overflow-hidden');

    const aside = screen.getByRole('complementary', { name: 'Điều hướng bài làm' });
    expect(aside).toHaveClass('lg:flex', 'lg:min-h-0', 'lg:flex-col');

    const main = screen.getByRole('main', { name: 'Nội dung câu hỏi' });
    expect(main).toHaveClass(
      'lg:min-h-0',
      'lg:overflow-y-auto',
      '[scrollbar-width:none]',
      '[-ms-overflow-style:none]',
      '[&::-webkit-scrollbar]:hidden',
    );

    expect(screen.getByRole('img', { name: 'Ảnh đại diện của An' })).toHaveAttribute(
      'src',
      'https://assets.example.test/an.png',
    );
  });

  it('puts an always-available desktop submit below navigation without bypassing confirmation', () => {
    render(<StudentView quiz={quiz} onExit={vi.fn()} onSaveResult={vi.fn()} />);

    const aside = screen.getByRole('complementary', { name: 'Điều hướng bài làm' });
    const desktopSubmit = within(aside).getByRole('button', { name: 'Nộp bài' });
    expect(desktopSubmit).not.toHaveClass('lg:hidden');

    fireEvent.click(desktopSubmit);
    expect(mocks.setShowSubmitConfirm).toHaveBeenCalledWith(true);

    const main = screen.getByRole('main', { name: 'Nội dung câu hỏi' });
    expect(within(main).getByRole('button', { name: 'Nộp bài' })).toHaveClass('lg:hidden');
  });

  it('passes the effective randomization policy into quiz state and question renderers', () => {
    render(<StudentView quiz={quiz} onExit={vi.fn()} onSaveResult={vi.fn()} />);

    expect(mocks.useQuizPlayerArgs).toHaveBeenCalledWith(expect.objectContaining({
      randomizationPolicy: mocks.policy,
    }));
    expect(mocks.questionPolicy).toHaveBeenCalledWith(mocks.policy);
  });

});
