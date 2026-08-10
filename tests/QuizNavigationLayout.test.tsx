import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import QuizNavigation from '../src/features/quiz-player/components/QuizNavigation';

const questions = Array.from({ length: 20 }, (_, index) => ({
  id: `q-${index + 1}`,
  type: 'MCQ',
  question: `Câu ${index + 1}`,
  options: ['A', 'B'],
})) as unknown as Question[];

const renderNavigation = (contained?: boolean) => render(
  <QuizNavigation
    questions={questions}
    progressByQuestionId={{}}
    activeQuestionId="q-1"
    QUESTIONS_PER_PAGE={10}
    onPageChange={vi.fn()}
    contained={contained}
  />,
);

describe('QuizNavigation desktop layout modes', () => {
  it('preserves the existing sticky navigation by default', () => {
    const { container } = renderNavigation();

    expect(container.firstElementChild).toHaveClass('sticky', 'top-24');
  });

  it('fits its content in the fixed sidebar while allowing the number grid to shrink and scroll', () => {
    const { container } = renderNavigation(true);

    expect(container.firstElementChild).toHaveClass('flex', 'min-h-0', 'flex-col', 'overflow-hidden');
    expect(container.firstElementChild).not.toHaveClass('sticky', 'flex-1');

    const questionList = screen.getByLabelText('Danh sách số câu');
    expect(questionList).toHaveClass(
      'min-h-0',
      'flex-1',
      'overflow-y-auto',
      '[scrollbar-width:none]',
      '[-ms-overflow-style:none]',
      '[&::-webkit-scrollbar]:hidden',
    );
  });
});
