import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizCreationChoicePanel from '../src/components/TeacherDashboard/overview/QuizCreationChoicePanel';

describe('QuizCreationChoicePanel', () => {
  it('presents both quiz creation paths and delegates each action', () => {
    const onCreateWithAi = vi.fn();
    const onCreateManually = vi.fn();

    render(
      <QuizCreationChoicePanel
        onCreateWithAi={onCreateWithAi}
        onCreateManually={onCreateManually}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Tạo đề kiểm tra' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo đề bằng AI' }));
    expect(onCreateWithAi).toHaveBeenCalledTimes(1);
    expect(onCreateManually).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Soạn đề thủ công' }));
    expect(onCreateManually).toHaveBeenCalledTimes(1);
  });

  it('uses the responsive cards layout', () => {
    render(
      <QuizCreationChoicePanel
        onCreateWithAi={vi.fn()}
        onCreateManually={vi.fn()}
      />,
    );

    expect(screen.getByTestId('quiz-creation-actions')).toHaveAttribute('data-layout', 'cards');
  });
});
