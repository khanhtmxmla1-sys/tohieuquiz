import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizCreationActions } from '../src/components/TeacherDashboard/quiz-creation';

describe('QuizCreationActions', () => {
  it('renders separate AI and manual actions and calls the matching callback', () => {
    const onCreateWithAi = vi.fn();
    const onCreateManually = vi.fn();

    render(
      <QuizCreationActions
        layout="cards"
        onCreateWithAi={onCreateWithAi}
        onCreateManually={onCreateManually}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề bằng AI' }));
    expect(onCreateWithAi).toHaveBeenCalledTimes(1);
    expect(onCreateManually).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Soạn đề thủ công' }));
    expect(onCreateManually).toHaveBeenCalledTimes(1);
    expect(onCreateWithAi).toHaveBeenCalledTimes(1);
  });

  it.each(['sidebar', 'cards', 'compact'] as const)('exposes the %s layout contract', (layout) => {
    render(
      <QuizCreationActions
        layout={layout}
        onCreateWithAi={vi.fn()}
        onCreateManually={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quiz-creation-actions')).toHaveAttribute('data-layout', layout);
    expect(screen.getByText('Tạo nhanh từ chủ đề, nội dung hoặc PDF.')).toBeInTheDocument();
    expect(screen.getByText('Tự nhập, sắp xếp và kiểm soát từng câu hỏi.')).toBeInTheDocument();
  });
});
