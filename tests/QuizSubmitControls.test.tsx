import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizPagination from '../src/features/quiz-player/components/QuizPagination';
import QuizSubmitButton from '../src/features/quiz-player/components/QuizSubmitButton';

describe('quiz submit controls', () => {
  it('uses one accessible submit button contract for normal and submitting states', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <QuizSubmitButton onSubmit={onSubmit} isSubmitting={false} className="w-full" />,
    );

    const button = screen.getByRole('button', { name: 'Nộp bài' });
    expect(button).toHaveClass('min-h-12', 'w-full');
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(<QuizSubmitButton onSubmit={onSubmit} isSubmitting className="w-full" />);
    expect(screen.getByRole('button', { name: 'Đang nộp bài...' })).toBeDisabled();
  });

  it('hides only the pagination submit on desktop when explicitly requested', () => {
    render(
      <QuizPagination
        currentPage={2}
        totalPages={2}
        onPageChange={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
        hideSubmitOnDesktop
      />,
    );

    expect(screen.getByRole('button', { name: 'Nộp bài' })).toHaveClass('lg:hidden');
  });

  it('keeps the shared pagination submit visible on desktop by default', () => {
    render(
      <QuizPagination
        currentPage={2}
        totalPages={2}
        onPageChange={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'Nộp bài' })).not.toHaveClass('lg:hidden');
  });
});
