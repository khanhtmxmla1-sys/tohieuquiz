import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuizCreationActions } from '../src/components/TeacherDashboard/quiz-creation';

describe('QuizCreationActions', () => {
  it('renders separate illustrated AI and manual actions and delegates each callback', () => {
    const onCreateWithAi = vi.fn();
    const onCreateManually = vi.fn();

    render(
      <QuizCreationActions
        layout="cards"
        manualQuizWorkspaceEnabled
        onCreateWithAi={onCreateWithAi}
        onCreateManually={onCreateManually}
      />,
    );

    const visuals = screen.getAllByRole('presentation', { hidden: true });
    expect(visuals).toHaveLength(2);
    expect(visuals[0]).toHaveAttribute('decoding', 'async');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề bằng AI' }));
    expect(onCreateWithAi).toHaveBeenCalledTimes(1);
    expect(onCreateManually).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Soạn đề thủ công' }));
    expect(onCreateManually).toHaveBeenCalledTimes(1);
  });

  it.each(['cards', 'compact'] as const)('exposes the %s layout contract', (layout) => {
    render(
      <QuizCreationActions
        layout={layout}
        manualQuizWorkspaceEnabled
        onCreateWithAi={vi.fn()}
        onCreateManually={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quiz-creation-actions')).toHaveAttribute('data-layout', layout);
    expect(screen.getByText('Tạo nhanh từ chủ đề, nội dung hoặc PDF.')).toBeInTheDocument();
    expect(screen.getByText('Tự nhập, sắp xếp và kiểm soát từng câu hỏi.')).toBeInTheDocument();
  });

  it('keeps one full-width legacy create action when the manual workspace is disabled', () => {
    const onCreateWithAi = vi.fn();
    render(
      <QuizCreationActions
        layout="cards"
        manualQuizWorkspaceEnabled={false}
        onCreateWithAi={onCreateWithAi}
        onCreateManually={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Tạo đề mới' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề mới' }));
    expect(onCreateWithAi).toHaveBeenCalledTimes(1);
  });
});
