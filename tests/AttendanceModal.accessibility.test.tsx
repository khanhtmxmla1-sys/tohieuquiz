// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceModal } from '../src/features/student-dashboard/components/AttendanceModal';

const attendance = (overrides: Record<string, unknown> = {}) => ({
  isOpen: true,
  attempt: {
    attemptId: 'attempt-1',
    status: 'IN_PROGRESS',
    completed: false,
    correctCount: 0,
    totalQuestions: 2,
    answeredCount: 0,
    items: [],
  },
  currentItem: {
    id: 'item-1',
    questionId: 'question-1',
    position: 1,
    question: '1 + 1 = ?',
    options: ['1', '2', '3', '4'],
    isAnswered: false,
  },
  currentNumber: 1,
  selectedAnswer: 'B',
  message: '',
  isSubmitting: false,
  completed: false,
  claimedToday: false,
  isVisible: true,
  isAvailable: true,
  badgeText: 'Điểm danh hôm nay',
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

    expect(screen.getByRole('dialog', { name: 'Điểm danh hôm nay' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Đóng hộp thoại điểm danh' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('announces the completed reward as a status and not an error', () => {
    render(<AttendanceModal attendance={attendance({
      completed: true,
      currentItem: null,
      attempt: {
        attemptId: 'attempt-1',
        status: 'COMPLETED',
        completed: true,
        correctCount: 1,
        totalQuestions: 2,
        answeredCount: 2,
        items: [],
        awardedCoins: 5,
        awardedExp: 10,
      },
    })} />);

    expect(screen.getByRole('status')).toHaveTextContent('Đã điểm danh');
    expect(screen.getByRole('status')).toHaveTextContent('1/2');
    expect(screen.getByRole('status')).toHaveTextContent('+5 Xu · +10 EXP');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
