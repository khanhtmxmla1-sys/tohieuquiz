import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Question } from '../src/types';
import ShortAnswerRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/ShortAnswerRenderer';
import MathRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/MathRenderer';
import GeometryRenderer from '../src/features/quiz-player/components/QuestionRenderer/renderers/GeometryRenderer';

vi.mock('../src/components/common/GeometryRenderer', () => ({
  default: () => <div>Hình minh họa</div>,
}));

const baseProps = (question: Question, answers: Record<string, unknown> = {}) => ({
  question,
  index: 0,
  answers,
  onAnswerChange: vi.fn(),
});

describe('quiz answer input accessibility', () => {
  it('labels the short-answer input', () => {
    const question = { id: 'short', type: 'SHORT_ANSWER', question: 'Điền từ' } as unknown as Question;
    render(<ShortAnswerRenderer {...baseProps(question)} />);
    expect(screen.getByRole('textbox', { name: 'Câu trả lời ngắn' })).toBeVisible();
  });

  it('labels numerator and denominator fields', () => {
    const question = {
      id: 'fraction', type: 'MATH_INPUT', question: 'Nhập phân số', mathType: 'fraction',
    } as unknown as Question;
    render(<MathRenderer {...baseProps(question)} />);
    expect(screen.getByRole('textbox', { name: 'Tử số' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Mẫu số' })).toBeVisible();
  });

  it('emits a gradable canonical value for a fraction while retaining field progress', () => {
    const question = {
      id: 'fraction-contract', type: 'MATH_INPUT', question: 'Nhập phân số',
      mathType: 'fraction', correctAnswer: '1/2',
    } as unknown as Question;
    const props = baseProps(question);
    const { rerender } = render(<MathRenderer {...props} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Tử số' }), { target: { value: '1' } });
    expect(props.onAnswerChange).toHaveBeenLastCalledWith('fraction-contract', {
      type: 'SHORT_ANSWER', value: '1/', numerator: '1', denominator: '',
    });

    const persistedProps = baseProps(question, {
      'fraction-contract': { type: 'SHORT_ANSWER', value: '1/', numerator: '1', denominator: '' },
    });
    rerender(<MathRenderer {...persistedProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Mẫu số' }), { target: { value: '2' } });
    expect(persistedProps.onAnswerChange).toHaveBeenCalledWith('fraction-contract', {
      type: 'SHORT_ANSWER', value: '1/2', numerator: '1', denominator: '2',
    });
  });

  it('labels a general math result and geometry result', () => {
    const mathQuestion = {
      id: 'math', type: 'MATH_INPUT', question: 'Tính kết quả', mathType: 'text',
    } as unknown as Question;
    const geometryQuestion = {
      id: 'geometry', type: 'GEOMETRY', question: 'Quan sát', geometryData: { type: 'point' },
    } as unknown as Question;

    const { rerender } = render(<MathRenderer {...baseProps(mathQuestion)} />);
    expect(screen.getByRole('textbox', { name: 'Kết quả toán học' })).toBeVisible();

    rerender(<GeometryRenderer {...baseProps(geometryQuestion)} />);
    expect(screen.getByRole('textbox', { name: 'Kết quả hình học' })).toBeVisible();
  });
});
