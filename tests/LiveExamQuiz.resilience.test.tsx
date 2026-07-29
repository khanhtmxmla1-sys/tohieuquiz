import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let online = true;
const submitMock = vi.hoisted(() => vi.fn());
const saveAnswerSnapshotMock = vi.hoisted(() => vi.fn());
const getAnswerSnapshotMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const updateActivityMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../src/hooks', () => ({
  useLiveExamTimer: () => ({ timeRemaining: 600, isExpired: false }),
  useLiveExamActivity: () => ({ updateActivity: updateActivityMock }),
}));
vi.mock('../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: online, lastChangedAt: null }),
}));
vi.mock('../src/services/liveExamService', () => ({
  submitAnswers: submitMock,
  saveAnswerSnapshot: saveAnswerSnapshotMock,
  getAnswerSnapshot: getAnswerSnapshotMock,
}));
vi.mock('../src/components/student/QuestionRenderer', () => ({
  default: ({ question, onAnswerChange }: any) => (
    <button type="button" onClick={() => onAnswerChange(question.id, 'A')}>Chọn đáp án A</button>
  ),
}));
vi.mock('../src/features/quiz-player/components/QuizHeader', () => ({
  default: () => <div>Live Exam Header</div>,
}));
vi.mock('../src/features/quiz-player/components/QuizNavigation', () => ({
  default: () => null,
}));
vi.mock('../src/features/quiz-player/components/QuizPagination', () => ({
  default: ({ onSubmit }: any) => <button type="button" onClick={onSubmit}>Nộp bài</button>,
}));
vi.mock('../src/components/student', () => ({
  SubmitConfirmModal: ({ isOpen, onConfirm }: any) => isOpen
    ? <button type="button" onClick={onConfirm}>Xác nhận nộp</button>
    : null,
}));

import { LiveExamQuiz } from '../src/components/LiveExam/LiveExamQuiz';

const question = {
  id: 'q1',
  quizId: 'quiz-1',
  type: 'MCQ',
  question: '1 + 1?',
  options: ['1', '2'],
  correctAnswer: 'B',
  points: 1,
};

const renderQuiz = (onComplete = vi.fn()) => render(
  <LiveExamQuiz
    sessionId="session-1"
    questions={[question] as any}
    quizTitle="Bài thi thử"
    duration={30}
    endsAt="2099-07-28T00:00:00.000Z"
    onComplete={onComplete}
  />,
);

describe('LiveExamQuiz resilience', () => {
  beforeEach(() => {
    online = true;
    submitMock.mockReset();
    saveAnswerSnapshotMock.mockReset().mockImplementation(async (_sessionId, snapshot) => ({
      attemptVersion: snapshot.attemptVersion,
      answers: snapshot.answers,
      updatedAt: '2026-07-29T00:00:00.000Z',
    }));
    getAnswerSnapshotMock.mockClear();
    updateActivityMock.mockClear();
    window.sessionStorage.clear();
  });

  it('persists answers locally and clears the draft only after a successful submit', async () => {
    const onComplete = vi.fn();
    submitMock.mockResolvedValue({
      participant: { score: 10, correctCount: 1, wrongCount: 0, submittedAt: '2026-07-28T00:00:00.000Z' },
    });
    renderQuiz(onComplete);

    fireEvent.click(screen.getByRole('button', { name: 'Chọn đáp án A' }));
    expect(await screen.findByText('Đáp án đã được lưu trên thiết bị')).toBeVisible();
    expect(window.sessionStorage.getItem('tohieuquiz_live_exam_answers_v1:session-1')).toContain('q1');

    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp' }));

    await waitFor(() => expect(submitMock).toHaveBeenCalledTimes(1));
    expect(submitMock).toHaveBeenCalledWith(
      'session-1',
      { q1: 'A' },
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^live-exam-submit-session-1:/) }),
    );
    expect(window.sessionStorage.getItem('tohieuquiz_live_exam_answers_v1:session-1')).toBeNull();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps the local draft and blocks submit while offline', async () => {
    online = false;
    renderQuiz();

    fireEvent.click(screen.getByRole('button', { name: 'Chọn đáp án A' }));
    expect(await screen.findByText('Mất kết nối — đáp án vẫn được lưu trên thiết bị')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Nộp bài' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nộp' }));

    expect(await screen.findByText(/Thiết bị đang ngoại tuyến/)).toBeVisible();
    expect(submitMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(window.sessionStorage.getItem('tohieuquiz_live_exam_answers_v1:session-1')).toContain('q1');
    });
  });
});
