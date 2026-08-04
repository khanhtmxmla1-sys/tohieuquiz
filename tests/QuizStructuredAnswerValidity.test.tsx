import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import MatchingRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MatchingRenderer';
import OrderingRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/OrderingRenderer';

describe('structured answer validity UI', () => {
  it('explains that a matching target is reassigned when selected again', () => {
    const question = {
      id: 'matching',
      type: 'MATCHING',
      pairs: [],
      leftItems: [{ id: 'l-0', content: 'Một' }, { id: 'l-1', content: 'Hai' }],
      rightItems: [{ id: 'r-0', content: '1' }, { id: 'r-1', content: '2' }],
    } as unknown as Question;

    render(
      <MatchingRenderer
        question={question}
        index={0}
        answers={{ matching: { __shuffledIds: ['r-0', 'r-1'] } }}
        onAnswerChange={vi.fn()}
        onMatchingClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/Mỗi mục ở cột B chỉ dùng một lần/)).toBeVisible();
  });

  it('shows persisted duplicate ordering ranks as an immediate error', () => {
    const question = {
      id: 'ordering',
      type: 'ORDERING',
      items: ['Câu một', 'Câu hai'],
    } as unknown as Question;

    render(
      <OrderingRenderer
        question={question}
        index={0}
        answers={{ ordering: { type: 'ORDERING', ranks: { 'item-0': 1, 'item-1': 1 } } }}
        onAnswerChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Số thứ tự 1 đang được dùng cho nhiều mục');
    screen.getAllByRole('spinbutton').forEach((input) => {
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });
});
