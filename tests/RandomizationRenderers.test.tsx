// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MCQRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MCQRenderer';
import MultipleSelectRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MultipleSelectRenderer';
import ImageQuestionRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/ImageQuestionRenderer';
import type { RandomizationPolicy } from '../shared/randomization-policy.contract';

const basePolicy: RandomizationPolicy = {
  enabled: true,
  shuffleQuestions: true,
  shuffleChoices: false,
  shuffleMatching: true,
  shuffleOrdering: true,
  shuffleDragDrop: true,
  randomizePracticeSelection: true,
};

const shuffledChoicesPolicy: RandomizationPolicy = { ...basePolicy, shuffleChoices: true };

const optionButtons = () => screen.getAllByRole('button');
const buttonText = () => optionButtons().map((button) => button.textContent?.replace(/\s+/g, ' ').trim());

describe('choice renderers randomization', () => {
  it('keeps MCQ canonical order when choice shuffle is off', () => {
    render(<MCQRenderer {...({
      question: { id: 'mcq-1', type: 'MCQ', options: ['Alpha', 'Beta', 'Gamma', 'Delta'] },
      index: 0,
      answers: {},
      onAnswerChange: vi.fn(),
      randomizationPolicy: basePolicy,
    } as any)} />);

    expect(buttonText()).toEqual(['AAlpha', 'BBeta', 'CGamma', 'DDelta']);
  });

  it('shuffles MCQ display deterministically while submitting the original stable option id', () => {
    const onAnswerChange = vi.fn();
    render(<MCQRenderer {...({
      question: { id: 'mcq-1', type: 'MCQ', options: ['Alpha', 'Beta', 'Gamma', 'Delta'] },
      index: 0,
      answers: {},
      onAnswerChange,
      randomizationPolicy: shuffledChoicesPolicy,
    } as any)} />);

    expect(buttonText()).toEqual(['ABeta', 'BGamma', 'CDelta', 'DAlpha']);
    fireEvent.click(optionButtons()[0]);
    expect(onAnswerChange).toHaveBeenCalledWith('mcq-1', { type: 'MCQ', optionId: 'option-1' });
  });

  it('uses original stable ids for multiple-select after display shuffle', () => {
    const onAnswerChange = vi.fn();
    render(<MultipleSelectRenderer {...({
      question: { id: 'multi-1', type: 'MULTIPLE_SELECT', options: ['Alpha', 'Beta', 'Gamma', 'Delta'] },
      index: 0,
      answers: {},
      onAnswerChange,
      randomizationPolicy: shuffledChoicesPolicy,
    } as any)} />);

    expect(buttonText()).toEqual(['ABeta', 'BGamma', 'CDelta', 'DAlpha']);
    fireEvent.click(optionButtons()[0]);
    expect(onAnswerChange).toHaveBeenCalledWith('multi-1', {
      type: 'MULTIPLE_SELECT', optionIds: ['option-1'],
    });
  });

  it('keeps each image paired with its original option after image-choice shuffle', () => {
    const onAnswerChange = vi.fn();
    render(<ImageQuestionRenderer {...({
      question: {
        id: 'image-1', type: 'IMAGE_QUESTION', options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
        optionImages: ['a.png', 'b.png', 'c.png', 'd.png'],
      },
      index: 0,
      answers: {},
      onAnswerChange,
      randomizationPolicy: shuffledChoicesPolicy,
    } as any)} />);

    expect(buttonText()).toEqual(['AGamma', 'BBeta', 'CDelta', 'DAlpha']);
    const firstImage = screen.getByAltText('Đáp án A: Gamma') as HTMLImageElement;
    expect(firstImage.getAttribute('src')).toContain('c.png');
    fireEvent.click(optionButtons()[0]);
    expect(onAnswerChange).toHaveBeenCalledWith('image-1', { type: 'IMAGE_QUESTION', optionId: 'option-2' });
  });
});
