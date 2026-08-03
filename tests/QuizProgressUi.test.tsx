import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizHeader from '../src/features/quiz-player/components/QuizHeader';
import SubmitConfirmModal from '../src/components/student/SubmitConfirmModal';
import QuestionRenderer from '../src/features/quiz-player/components/QuestionRenderer';
import type { Question } from '../src/types';

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

  it('shows a complete badge and filled input state for a student-safe short answer', () => {
    const question = {
      id: 'short-progress',
      type: 'SHORT_ANSWER',
      question: 'The eraser is ____.',
    } as unknown as Question;

    render(
      <QuestionRenderer
        question={question}
        index={0}
        answers={{ 'short-progress': 'mine' }}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Đã hoàn thành/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập câu trả lời của em...')).toHaveClass(
      'border-sky-500',
      'bg-sky-50/60',
    );
  });

  it('shows partial progress for a structured true-false answer', () => {
    const question = {
      id: 'tf-progress',
      type: 'TRUE_FALSE',
      mainQuestion: 'Chọn đúng hoặc sai',
      items: [{ id: 'a', statement: 'Ý a' }, { id: 'b', statement: 'Ý b' }],
    } as unknown as Question;

    render(
      <QuestionRenderer
        question={question}
        index={0}
        answers={{ 'tf-progress': { a: true } }}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Đang làm · 1/2')).toBeInTheDocument();
  });

  it('uses filled and empty input states for an error-correction answer', () => {
    const question = {
      id: 'error-progress',
      type: 'ERROR_CORRECTION',
      question: 'Tìm và sửa từ sai',
      passage: 'Bé rất ngoãn.',
    } as unknown as Question;

    render(
      <QuestionRenderer
        question={question}
        index={0}
        answers={{ 'error-progress': { wrongWord: 'ngoãn', correctWord: '' } }}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Đang làm · 1/2')).toBeInTheDocument();
    expect(screen.getByLabelText('Từ viết sai')).toHaveClass('border-sky-500', 'bg-sky-50/60');
    expect(screen.getByLabelText('Từ sửa đúng')).toHaveClass('border-slate-300', 'bg-white');
  });

  it('uses blue for an existing matching pair', () => {
    const question = {
      id: 'matching-progress',
      type: 'MATCHING',
      question: 'Nối cặp',
      pairs: [],
      leftItems: [{ id: 'l-0', content: 'Một' }, { id: 'l-1', content: 'Hai' }],
      rightItems: [{ id: 'r-0', content: '1' }, { id: 'r-1', content: '2' }],
    } as unknown as Question;

    render(
      <QuestionRenderer
        question={question}
        index={0}
        answers={{
          'matching-progress': {
            'l-0': 'r-0',
            __shuffledIds: ['r-0', 'r-1'],
          },
        }}
        onAnswerChange={vi.fn()}
        onMatchingClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Đang làm · 1/2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Một/ })).toHaveClass('border-sky-600', 'bg-sky-100');
    expect(screen.getByRole('button', { name: /Cặp 1.*1/ })).toHaveClass('border-sky-600', 'bg-sky-100');
  });

  it('uses blue for a filled ordering rank while the question remains partial', () => {
    const question = {
      id: 'ordering-progress',
      type: 'ORDERING',
      question: 'Sắp xếp',
      items: ['Câu một', 'Câu hai'],
    } as unknown as Question;

    render(
      <QuestionRenderer
        question={question}
        index={0}
        answers={{
          'ordering-progress': {
            type: 'ORDERING',
            ranks: { 'item-0': 1 },
          },
        }}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Đang làm · 1/2')).toBeInTheDocument();
    const filledInput = screen.getAllByRole('spinbutton').find((input) => (
      (input as HTMLInputElement).value === '1'
    ));
    expect(filledInput).toHaveClass('border-sky-500', 'bg-sky-50/60');
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
