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
  words: ['từ một', 'từ hai'],
} as unknown as Question;

describe('quiz answer state colors', () => {
  it('shows a selected multiple-choice answer in green', () => {
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
    expect(selectedAnswer).toHaveClass('border-emerald-500', 'bg-emerald-50', 'text-emerald-950');
    expect(selectedAnswer.querySelector('span')).toHaveClass('bg-emerald-500');
  });

  it('uses green for other selectable answer types', () => {
    const { unmount } = render(
      <MultipleSelectRenderer
        question={multipleSelectQuestion}
        index={0}
        answers={{ 'multi-1': ['A'] }}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Một/ })).toHaveClass(
      'border-emerald-500',
      'bg-emerald-50',
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
      'border-emerald-500',
      'bg-emerald-50',
    );
    imageRender.unmount();

    render(
      <UnderlineRenderer
        question={underlineQuestion}
        index={0}
        answers={{ 'underline-1': [1] }}
        onAnswerChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'từ hai' })).toHaveClass(
      'border-emerald-500',
      'bg-emerald-50',
    );
  });

  it('uses green for Đúng and red for Sai after selection', () => {
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
    expect(trueButton).toHaveClass('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
    expect(falseButton).not.toHaveClass('bg-red-50');

    fireEvent.click(falseButton);
    expect(falseButton).toHaveClass('border-red-500', 'bg-red-50', 'text-red-700');
    expect(trueButton).not.toHaveClass('bg-emerald-50');
  });

  it('marks answered question numbers in green while preserving the active focus ring', () => {
    render(
      <QuizNavigation
        questions={[mcqQuestion, { ...mcqQuestion, id: 'mcq-2' } as Question]}
        isQuestionAnswered={(question) => question.id === 'mcq-1'}
        activeQuestionId="mcq-1"
        QUESTIONS_PER_PAGE={10}
        onPageChange={vi.fn()}
      />,
    );

    const answeredQuestion = screen.getByRole('button', { name: 'Đi đến câu 1' });
    const unansweredQuestion = screen.getByRole('button', { name: 'Đi đến câu 2' });

    expect(answeredQuestion).toHaveClass('border-emerald-500', 'bg-emerald-50', 'text-emerald-800');
    expect(answeredQuestion).toHaveClass('ring-1', 'ring-sky-500');
    expect(unansweredQuestion).toHaveClass('border-slate-200', 'bg-white');
    expect(screen.getByText('Đã trả lời').previousElementSibling).toHaveClass('bg-emerald-50');
  });
});
