import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuestionRenderer from '../src/features/quiz-player/components/QuestionRenderer';

vi.mock('../src/features/quiz-player/components/QuestionRenderer/utils/SmartText', () => ({
  default: ({ content }: { content: unknown }) => <span>{String(content ?? '')}</span>,
}));
vi.mock('../src/features/quiz-player/components/QuestionRenderer/atoms/MathSpan', () => ({
  default: ({ content }: { content: unknown }) => <span>{String(content ?? '')}</span>,
}));

const props = (question: Record<string, unknown>, answers: Record<string, unknown> = {}) => ({
  question: question as any,
  index: 0,
  answers,
  onAnswerChange: vi.fn(),
});

describe('QuestionRenderer coverage', () => {
  it('renders word scramble as selectable letter indexes', () => {
    const rendererProps = props({
      id: 'word', type: 'WORD_SCRAMBLE', question: 'Ghép từ', letters: ['H', 'O', 'A'],
    });
    render(<QuestionRenderer {...rendererProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chọn chữ H' }));
    expect(rendererProps.onAnswerChange).toHaveBeenCalledWith('word', [0]);
  });

  it('renders a riddle text answer', () => {
    const rendererProps = props({
      id: 'riddle', type: 'RIDDLE', question: 'Đố vui', riddleLines: ['Hoa gì nở mùa hè?'],
    });
    render(<QuestionRenderer {...rendererProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Đáp án câu đố' }), { target: { value: 'hoa phượng' } });
    expect(rendererProps.onAnswerChange).toHaveBeenCalledWith('riddle', 'hoa phượng');
  });

  it('renders two fields for error correction', () => {
    const rendererProps = props({
      id: 'error', type: 'ERROR_CORRECTION', question: 'Tìm lỗi', passage: 'Bạn nhỏ rất ngoãn.',
    });
    render(<QuestionRenderer {...rendererProps} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Từ viết sai' }), { target: { value: 'ngoãn' } });
    expect(rendererProps.onAnswerChange).toHaveBeenCalledWith('error', { wrongWord: 'ngoãn', correctWord: '' });
  });

  it('shows an explicit unsupported state instead of falling back to MCQ', () => {
    render(<QuestionRenderer {...props({ id: 'unknown', type: 'ALIEN_TYPE', question: 'Unknown' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Dạng câu hỏi này chưa được hỗ trợ');
  });
});
