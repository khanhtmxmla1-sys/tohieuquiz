import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import QuizNavigation from '../src/features/quiz-player/components/QuizNavigation';
import MCQRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MCQRenderer';
import MultipleSelectRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MultipleSelectRenderer';
import ImageQuestionRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/ImageQuestionRenderer';
import UnderlineRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/UnderlineRenderer';
import TrueFalseRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/TrueFalseRenderer';

vi.mock('../src/features/quiz-player/components/QuestionRenderer/atoms/MathSpan', () => ({
  default: ({ content, className }: { content: string; className?: string }) => (
    <span className={className}>{content}</span>
  ),
}));

const mcqQuestion = {
  id: 'mcq-1',
  type: 'MULTIPLE_CHOICE',
  text: 'Chọn đáp án đúng',
  options: ['A. Một', 'B. Hai'],
} as unknown as Question;

const trueFalseQuestion = {
  id: 'tf-1',
  type: 'TRUE_FALSE',
  text: 'Đánh dấu đúng hoặc sai',
  items: [{ id: 'statement-1', statement: 'Một cộng một bằng hai.' }],
} as unknown as Question;

const multipleSelectQuestion = {
  id: 'multi-1',
  type: 'MULTIPLE_SELECT',
  text: 'Chọn nhiều đáp án',
  options: ['A. Một', 'B. Hai'],
} as unknown as Question;

const imageQuestion = {
  id: 'image-1',
  type: 'IMAGE_QUESTION',
  text: 'Chọn hình phù hợp',
  options: ['Hình một', 'Hình hai'],
  optionImages: ['', ''],
} as unknown as Question;

const underlineQuestion = {
  id: 'underline-1',
  type: 'UNDERLINE',
  text: 'Chọn từ cần gạch chân',
  sentence: 'từ một từ hai',
  words: ['từ', 'một', 'từ', 'hai'],
} as unknown as Question;

describe('quiz answer state colors', () => {
  it('shows a selected multiple-choice answer in blue', () => {
    render(
      <MCQRenderer
        question={mcqQuestion}
        index={0}
        answers={{ 'mcq-1': 'B' }}
        onAnswerChange={vi.fn()}
      />,
    );

    const selectedAnswer = screen.getByRole('button', { name: /Hai/ });
    expect(selectedAnswer).toHaveAttribute('aria-pressed', 'true');
    expect(selectedAnswer).toHaveClass('border-sky-600', 'bg-sky-100', 'text-sky-950');
    expect(selectedAnswer.querySelector('span')).toHaveClass('bg-sky-600');
  });

  it('uses expected selected states for other selectable answer types, including natural UNDERLINE text', () => {
    const { unmount } = render(
      <MultipleSelectRenderer
        question={multipleSelectQuestion}
        index={0}
        answers={{ 'multi-1': ['A'] }}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Một/ })).toHaveClass(
      'border-sky-600',
      'bg-sky-100',
    );
    unmount();

    const imageRender = render(
      <ImageQuestionRenderer
        question={imageQuestion}
        index={0}
        answers={{ 'image-1': 'B' }}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Hình hai/ })).toHaveClass(
      'border-sky-600',
      'bg-sky-100',
    );
    imageRender.unmount();

    render(
      <UnderlineRenderer
        question={underlineQuestion}
        index={0}
        answers={{ 'underline-1': [3] }}
        onAnswerChange={vi.fn()}
      />,
    );
    const selectedUnderline = screen.getByRole('button', { name: 'hai' });
    expect(selectedUnderline).toHaveAttribute('aria-pressed', 'true');
    expect(selectedUnderline).toHaveClass(
      'underline',
      'decoration-sky-600',
      'underline-offset-[4px]',
    );
    expect(selectedUnderline).not.toHaveClass('border', 'bg-sky-100', 'px-4');
    expect(screen.getByText('Em hãy nhấn vào từ hoặc cụm từ cần gạch chân.')).toBeInTheDocument();
  });

  it('keeps underline selections sorted while toggling indexes without duplicates', () => {
    const onAnswerChange = vi.fn();
    const question = {
      ...underlineQuestion,
      id: 'underline-2',
      sentence: 'một hai ba bốn',
      words: ['một', 'hai', 'ba', 'bốn'],
    } as unknown as Question;

    const Harness = () => {
      const [answers, setAnswers] = useState<Record<string, any>>({ 'underline-2': [3, 1] });

      return (
        <UnderlineRenderer
          question={question}
          index={0}
          answers={answers}
          onAnswerChange={(questionId, value) => {
            onAnswerChange(questionId, value);
            setAnswers((current) => ({ ...current, [questionId]: value }));
          }}
        />
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'ba' }));
    expect(onAnswerChange).toHaveBeenLastCalledWith('underline-2', [1, 2, 3]);

    fireEvent.click(screen.getByRole('button', { name: 'hai' }));
    expect(onAnswerChange).toHaveBeenLastCalledWith('underline-2', [2, 3]);
  });

  it('uses the same blue selected state for Đúng and Sai', () => {
    const Harness = () => {
      const [answers, setAnswers] = useState<Record<string, any>>({});
      return (
        <TrueFalseRenderer
          question={trueFalseQuestion}
          index={0}
          answers={answers}
          onAnswerChange={(questionId, value, itemKey) => {
            setAnswers((current) => ({
              ...current,
              [questionId]: { ...(current[questionId] || {}), [itemKey!]: value },
            }));
          }}
        />
      );
    };

    render(<Harness />);

    const trueButton = screen.getByRole('button', { name: 'Đúng' });
    const falseButton = screen.getByRole('button', { name: 'Sai' });

    fireEvent.click(trueButton);
    expect(trueButton).toHaveClass('border-sky-600', 'bg-sky-100', 'text-sky-950');
    expect(falseButton).not.toHaveClass('bg-red-50');

    fireEvent.click(falseButton);
    expect(falseButton).toHaveClass('border-sky-600', 'bg-sky-100', 'text-sky-950');
    expect(trueButton).not.toHaveClass('bg-sky-100');
  });

  it('shows clear empty, partial, and complete question states while preserving the active ring', () => {
    const partialQuestion = { ...mcqQuestion, id: 'mcq-2' } as Question;
    const emptyQuestion = { ...mcqQuestion, id: 'mcq-3' } as Question;
    render(
      <QuizNavigation
        questions={[mcqQuestion, partialQuestion, emptyQuestion]}
        progressByQuestionId={{
          'mcq-1': { state: 'complete', hasInteraction: true, completedParts: 1, requiredParts: 1 },
          'mcq-2': { state: 'partial', hasInteraction: true, completedParts: 1, requiredParts: 2 },
          'mcq-3': { state: 'empty', hasInteraction: false, completedParts: 0, requiredParts: 1 },
        }}
        activeQuestionId="mcq-1"
        QUESTIONS_PER_PAGE={10}
        onPageChange={vi.fn()}
      />,
    );

    const completeButton = screen.getByRole('button', { name: 'Đi đến câu 1' });
    const partialButton = screen.getByRole('button', { name: 'Đi đến câu 2' });
    const emptyButton = screen.getByRole('button', { name: 'Đi đến câu 3' });

    expect(completeButton).toHaveClass('bg-emerald-600', 'border-emerald-700', 'text-white');
    expect(completeButton).toHaveClass('ring-2', 'ring-sky-500');
    expect(partialButton).toHaveClass('bg-amber-100', 'border-amber-500', 'text-amber-950');
    expect(emptyButton).toHaveClass('bg-white', 'border-slate-300');
    expect(screen.getByText('Đang làm')).toBeInTheDocument();
    expect(screen.getByText('Đã hoàn thành')).toBeInTheDocument();
  });
});
