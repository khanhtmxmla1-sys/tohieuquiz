// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceModal } from '../src/features/student-dashboard/components/AttendanceModal';

const attendance = (overrides: Record<string, unknown> = {}) => ({
  isOpen: true,
  question: {
    id: 'quiz-1-question-1',
    quizId: 'quiz-1',
    questionId: 'question-1',
    quizTitle: 'Toán',
    question: '1 + 1 = ?',
    options: ['A. 1', 'B. 2'],
    correctLabel: 'B',
  },
  selectedAnswer: 'B',
  result: null,
  message: '',
  isSubmitting: false,
  claimedToday: false,
  isAvailable: true,
  badgeText: 'Điểm danh',
  open: vi.fn(),
  close: vi.fn(),
  submit: vi.fn(),
  selectAnswer: vi.fn(),
  ...overrides,
}) as any;

describe('AttendanceModal accessibility', () => {
  it('uses dialog semantics, manages initial focus, and closes on Escape', () => {
    const close = vi.fn();
    render(<AttendanceModal attendance={attendance({ close })} />);

    expect(screen.getByRole('dialog', { name: 'Câu hỏi ngẫu nhiên' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Đóng hộp thoại điểm danh' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('announces an already-claimed message as informational rather than an error', () => {
    render(<AttendanceModal attendance={attendance({ result: 'info', message: 'Hôm nay em đã điểm danh rồi.' })} />);

    expect(screen.getByRole('status')).toHaveTextContent('Hôm nay em đã điểm danh rồi.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
