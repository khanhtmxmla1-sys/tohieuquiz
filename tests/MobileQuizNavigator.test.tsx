import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import MobileQuizNavigator from '../src/features/quiz-player/components/MobileQuizNavigator';

const questions = Array.from({ length: 12 }, (_, index) => ({
  id: `q-${index + 1}`,
  type: 'MCQ',
  question: `Câu ${index + 1}`,
  options: ['A', 'B'],
})) as unknown as Question[];

const progressByQuestionId = {
  'q-1': { state: 'complete', hasInteraction: true, completedParts: 1, requiredParts: 1 },
  'q-2': { state: 'partial', hasInteraction: true, completedParts: 1, requiredParts: 2 },
} as const;

describe('MobileQuizNavigator', () => {
  it('opens a named bottom sheet and navigates to the exact question', () => {
    const onPageChange = vi.fn();
    render(
      <MobileQuizNavigator
        questions={questions}
        progressByQuestionId={progressByQuestionId as any}
        activeQuestionId="q-1"
        questionsPerPage={10}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mở danh sách câu hỏi' }));
    expect(screen.getByRole('dialog', { name: 'Danh sách câu hỏi' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Chưa trả lời')).toBeVisible();
    expect(screen.getByText('Đang làm')).toBeVisible();
    expect(screen.getByText('Đã hoàn thành')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Đi đến câu 12' }));
    expect(onPageChange).toHaveBeenCalledWith(2, 'q-12');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with Escape and restores focus to the opener', () => {
    render(
      <MobileQuizNavigator
        questions={questions}
        progressByQuestionId={{}}
        activeQuestionId={null}
        questionsPerPage={10}
        onPageChange={vi.fn()}
      />,
    );

    const opener = screen.getByRole('button', { name: 'Mở danh sách câu hỏi' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('button', { name: 'Đóng danh sách câu hỏi' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
