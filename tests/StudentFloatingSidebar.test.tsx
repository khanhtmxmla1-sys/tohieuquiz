import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getStudentLeaderboardMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/gamificationService', () => ({
  getStudentLeaderboard: getStudentLeaderboardMock,
}));

import { StudentFloatingSidebar } from '../src/components/gamification/StudentFloatingSidebar';
import type { StudentLeaderboardData } from '../src/types/gamification.types';

const leaderboardData: StudentLeaderboardData = {
  topStudents: [
    {
      studentId: 'student-1',
      fullName: 'Nguyễn Minh Anh',
      avatar: 'default',
      className: '5A',
      rank: 1,
      xu: 175,
    },
  ],
  currentStudent: {
    studentId: 'student-1',
    fullName: 'Nguyễn Minh Anh',
    avatar: 'default',
    className: '5A',
    rank: 1,
    xu: 175,
    gapToNext: null,
  },
  totalStudents: 1,
  period: 'week',
  scope: 'school',
  updatedAt: '2026-10-01T01:00:00.000Z',
};

describe('StudentFloatingSidebar compact launcher', () => {
  beforeEach(() => {
    getStudentLeaderboardMock.mockReset();
    getStudentLeaderboardMock.mockResolvedValue(leaderboardData);
    document.body.style.overflow = '';
  });

  it('uses the trophy mascot as an icon-only trigger and keeps it above the mobile nav', () => {
    render(<StudentFloatingSidebar />);

    const trigger = screen.getByRole('button', { name: 'Mở bảng vàng học sinh' });
    const triggerContainer = trigger.parentElement;

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(within(trigger).queryByText(/bảng vàng/i)).not.toBeInTheDocument();
    expect(trigger.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/gamification/cheerful-golden-trophy-mascot.png',
    );
    expect(triggerContainer).toHaveClass(
      'bottom-[calc(5rem+env(safe-area-inset-bottom))]',
      'md:bottom-5',
    );
  });

  it('opens the rich leaderboard centered in the viewport while preserving the new tabs', async () => {
    render(<StudentFloatingSidebar />);

    const trigger = screen.getByRole('button', { name: 'Mở bảng vàng học sinh' });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });
    const layer = dialog.parentElement;

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(dialog).toHaveAttribute('id', 'student-golden-board-popup');
    expect(dialog).toHaveClass('max-w-[22rem]', 'rounded-[24px]', 'md:max-h-[70vh]');
    expect(layer).toHaveClass('items-center', 'justify-center', 'p-4', 'sm:p-5');
    expect(screen.getByRole('tab', { name: 'Tuần này' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Lớp của em' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Toàn trường' })).toBeInTheDocument();
    await waitFor(() => {
      expect(getStudentLeaderboardMock).toHaveBeenCalledWith({ scope: 'school', period: 'week' });
    });
  });

  it('closes the popup from the close button', async () => {
    render(<StudentFloatingSidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));
    expect(await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng vàng' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Bảng vàng học sinh' })).not.toBeInTheDocument();
    });
  });
});
