// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MatchingRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MatchingRenderer';
import OrderingRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/OrderingRenderer';
import FillInTheBlankRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer';
import type { RandomizationPolicy } from '../shared/randomization-policy.contract';

const offPolicy: RandomizationPolicy = {
  enabled: false,
  shuffleQuestions: false,
  shuffleChoices: false,
  shuffleMatching: false,
  shuffleOrdering: false,
  shuffleDragDrop: false,
  randomizePracticeSelection: false,
};

const buttonTexts = () => screen.getAllByRole('button').map((button) => button.textContent?.trim() || '');

describe('structured renderer randomization policy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps matching right-column order canonical when matching shuffle is off', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<MatchingRenderer {...({
      question: {
        id: 'matching-1', type: 'MATCHING',
        pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }, { left: 'C', right: '3' }],
      },
      index: 0,
      answers: {},
      onAnswerChange: vi.fn(),
      onMatchingClick: vi.fn(),
      randomizationPolicy: offPolicy,
    } as any)} />);

    expect(buttonTexts().slice(-3)).toEqual(['1', '2', '3']);
  });

  it('keeps ordering items canonical when ordering shuffle is off', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<OrderingRenderer {...({
      question: { id: 'ordering-1', type: 'ORDERING', items: ['First', 'Second', 'Third'] },
      index: 0,
      answers: {},
      onAnswerChange: vi.fn(),
      randomizationPolicy: offPolicy,
    } as any)} />);

    const rows = screen.getAllByRole('spinbutton').map((input) => input.parentElement?.parentElement?.textContent || '');
    expect(rows[0]).toContain('First');
    expect(rows[1]).toContain('Second');
    expect(rows[2]).toContain('Third');
  });

  it('keeps drag-drop pool canonical when drag-drop shuffle is off', () => {
    render(<FillInTheBlankRenderer {...({
      question: {
        id: 'drag-1', type: 'DRAG_DROP', text: '[1] [2] [3]', blanks: ['one', 'two', 'three'], distractors: [],
      },
      index: 0,
      answers: {},
      onAnswerChange: vi.fn(),
      randomizationPolicy: offPolicy,
    } as any)} />);

    const pool = buttonTexts().filter((text) => ['one', 'two', 'three'].includes(text));
    expect(pool).toEqual(['one', 'two', 'three']);
  });
});
