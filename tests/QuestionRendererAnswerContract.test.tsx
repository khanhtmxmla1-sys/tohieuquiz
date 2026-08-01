import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FillInTheBlankRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer';

vi.mock('../src/features/quiz-player/components/QuestionRenderer/utils/SmartText', () => ({
  default: ({ content }: { content: unknown }) => <span>{String(content ?? '')}</span>,
}));
vi.mock('../src/features/quiz-player/components/QuestionRenderer/atoms/MathSpan', () => ({
  default: ({ content }: { content: unknown }) => <span>{String(content ?? '')}</span>,
}));

describe('question renderer answer contract', () => {
  it('uses the stored blank id instead of the placeholder token', () => {
    const onAnswerChange = vi.fn();
    render(
      <FillInTheBlankRenderer
        question={{
          id: 'drop',
          type: 'DROPDOWN',
          question: 'Chọn',
          text: '[blank_0]',
          blanks: [{ id: 'stored-blank-id', options: ['x', 'y'], correctAnswer: 'x' }],
        } as any}
        index={0}
        answers={{}}
        onAnswerChange={onAnswerChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'x' } });
    expect(onAnswerChange).toHaveBeenCalledWith('drop', 'x', 'stored-blank-id');
  });
});
