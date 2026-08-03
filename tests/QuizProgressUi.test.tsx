import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizHeader from '../src/features/quiz-player/components/QuizHeader';
import SubmitConfirmModal from '../src/components/student/SubmitConfirmModal';

describe('quiz progress summary UI', () => {
  it('shows completed and partial counts in the quiz header', () => {
    render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={30}
        completedCount={3}
        partialCount={1}
        isPractice
        studentName="An"
      />,
    );

    expect(screen.getByText('An · Đã hoàn thành 3/30 câu · Đang làm 1 câu')).toBeInTheDocument();
  });

  it('omits the partial suffix when no question is in progress', () => {
    render(
      <QuizHeader
        title="Bài kiểm tra"
        timeLeft={600}
        totalQuestions={10}
        completedCount={4}
        partialCount={0}
        isPractice
      />,
    );

    expect(screen.getByText('Đã hoàn thành 4/10 câu')).toBeInTheDocument();
    expect(screen.queryByText(/Đang làm/)).not.toBeInTheDocument();
  });

  it('separates unanswered and partial questions in the submit modal', () => {
    render(
      <SubmitConfirmModal
        isOpen
        emptyCount={2}
        partialCount={1}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 câu chưa bắt đầu/)).toBeInTheDocument();
    expect(screen.getByText(/1 câu đang làm dở/)).toBeInTheDocument();
  });

  it('confirms when all questions are complete', () => {
    render(
      <SubmitConfirmModal
        isOpen
        emptyCount={0}
        partialCount={0}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Bạn đã hoàn thành tất cả câu hỏi/)).toBeInTheDocument();
  });
});
