import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FillInTheBlankRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/FillInTheBlankRenderer';
import MCQRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MCQRenderer';
import MultipleSelectRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MultipleSelectRenderer';
import OrderingRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/OrderingRenderer';
import ImageQuestionRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/ImageQuestionRenderer';

vi.mock('../src/features/quiz-player/components/QuestionRenderer/utils/SmartText', () => ({
  default: ({ content }: { content: unknown }) => <span>{String(content ?? '')}</span>,
}));
vi.mock('../src/features/quiz-player/components/QuestionRenderer/atoms/MathSpan', () => ({
  default: ({ content }: { content: unknown }) => <span>{String(content ?? '')}</span>,
}));

describe('question renderer answer contract', () => {
  it('emits a canonical option ID for MCQ while reading a legacy label', () => {
    const onAnswerChange = vi.fn();
    const question = { id: 'mcq', type: 'MCQ', question: 'Chọn', options: ['Một', 'Hai'], correctAnswer: 'A' } as any;
    const { rerender } = render(
      <MCQRenderer question={question} index={0} answers={{ mcq: 'B' }} onAnswerChange={onAnswerChange} />,
    );
    expect(screen.getByRole('button', { name: /Hai/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Một/ }));
    expect(onAnswerChange).toHaveBeenCalledWith('mcq', { type: 'MCQ', optionId: 'option-0' });

    rerender(
      <MCQRenderer
        question={question}
        index={0}
        answers={{ mcq: { type: 'MCQ', optionId: 'option-0' } }}
        onAnswerChange={onAnswerChange}
      />,
    );
    expect(screen.getByRole('button', { name: /Một/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('emits sorted canonical option IDs for multiple select', () => {
    const onAnswerChange = vi.fn();
    const question = {
      id: 'multi', type: 'MULTIPLE_SELECT', question: 'Chọn',
      options: ['Một', 'Hai', 'Ba'], correctAnswers: ['A', 'C'],
    } as any;
    render(
      <MultipleSelectRenderer
        question={question}
        index={0}
        answers={{ multi: ['C'] }}
        onAnswerChange={onAnswerChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Một/ }));
    expect(onAnswerChange).toHaveBeenCalledWith('multi', {
      type: 'MULTIPLE_SELECT',
      optionIds: ['option-0', 'option-2'],
    });
  });

  it('emits stable item IDs for ordering ranks while reading numeric legacy keys', () => {
    const onAnswerChange = vi.fn();
    const question = {
      id: 'order', type: 'ORDERING', question: 'Sắp xếp',
      items: ['Bước A', 'Bước B'], correctOrder: [0, 1],
    } as any;
    render(
      <OrderingRenderer
        question={question}
        index={0}
        answers={{ order: { 0: 1 } }}
        onAnswerChange={onAnswerChange}
      />,
    );
    const inputs = screen.getAllByRole('spinbutton');
    const emptyInput = inputs.find((input) => (input as HTMLInputElement).value === '')!;
    fireEvent.change(emptyInput, { target: { value: '2' } });
    expect(onAnswerChange).toHaveBeenCalledWith('order', {
      type: 'ORDERING',
      ranks: { 'item-0': 1, 'item-1': 2 },
    });
  });

  it('emits a canonical option ID for image questions', () => {
    const onAnswerChange = vi.fn();
    const question = {
      id: 'image', type: 'IMAGE_QUESTION', question: 'Chọn hình',
      options: ['Tròn', 'Vuông'], correctAnswer: 'A', optionImages: ['', ''],
    } as any;
    render(
      <ImageQuestionRenderer question={question} index={0} answers={{ image: 'A' }} onAnswerChange={onAnswerChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Vuông/ }));
    expect(onAnswerChange).toHaveBeenCalledWith('image', {
      type: 'IMAGE_QUESTION',
      optionId: 'option-1',
    });
  });

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

  it('renders object-based drag-drop answers in the choice pool without duplicating distractors', () => {
    const onAnswerChange = vi.fn();
    render(
      <FillInTheBlankRenderer
        question={{
          id: 'drag-object-blanks',
          type: 'DRAG_DROP',
          question: 'Kéo từ',
          text: 'It is [1]. This is [2] bag.',
          blanks: [
            { id: 'blank-0', correctAnswer: 'hers' },
            { id: 'blank-1', correctAnswer: 'her' },
          ],
          distractors: ['mine', 'hers'],
        } as any}
        index={0}
        answers={{}}
        onAnswerChange={onAnswerChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'hers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'her' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mine' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'hers' })).toHaveLength(1);
  });
  it('renders a selected drag-drop LaTeX answer as rich content instead of a text input', () => {
    const onAnswerChange = vi.fn();
    render(
      <FillInTheBlankRenderer
        question={{
          id: 'drag-latex',
          type: 'DRAG_DROP',
          question: 'Kéo số',
          text: 'Mỗi bao nặng: 350 : 7 = [1] (kg).',
          blanks: [{ id: 'blank-0', correctAnswer: '$50$' }],
        } as any}
        index={0}
        answers={{ 'drag-latex': { 'blank-0': '$50$' } }}
        onAnswerChange={onAnswerChange}
      />,
    );

    expect(screen.queryByRole('textbox', { name: 'Ô trống blank-0' })).not.toBeInTheDocument();
    const selectedBlank = screen.getByRole('button', { name: 'Xóa đáp án ô blank-0' });
    expect(selectedBlank).toHaveTextContent('$50$');

    fireEvent.click(selectedBlank);
    expect(onAnswerChange).toHaveBeenCalledWith('drag-latex', '', 'blank-0');
  });
  it('keeps a non-drag fill-in-the-blank as an editable textbox', () => {
    const onAnswerChange = vi.fn();
    render(
      <FillInTheBlankRenderer
        question={{
          id: 'fill-text',
          type: 'FILL_IN_THE_BLANK',
          question: 'Điền đáp án',
          text: 'Kết quả là [1].',
          blanks: [{ id: 'blank-0', correctAnswer: '50' }],
        } as any}
        index={0}
        answers={{}}
        onAnswerChange={onAnswerChange}
      />,
    );

    const textbox = screen.getByRole('textbox', { name: 'Ô trống blank-0' });
    expect(textbox).toBeInTheDocument();
    fireEvent.change(textbox, { target: { value: '50' } });
    expect(onAnswerChange).toHaveBeenCalledWith('fill-text', '50', 'blank-0');
  });
});
