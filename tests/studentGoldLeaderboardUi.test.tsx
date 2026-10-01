import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getStudentLeaderboardMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/gamificationService', () => ({
  getStudentLeaderboard: getStudentLeaderboardMock,
}));

import { StudentFloatingSidebar } from '../src/components/gamification/StudentFloatingSidebar';
import type { StudentLeaderboardData } from '../src/types/gamification.types';

const makeData = (overrides: Partial<StudentLeaderboardData> = {}): StudentLeaderboardData => ({
  topStudents: [
    { studentId: 'student-1', fullName: 'Nguyễn An', avatar: 'girl_01', className: '5A', rank: 1, xu: 120 },
    { studentId: 'student-3', fullName: 'Lê Chi', avatar: 'boy_01', className: '5B', rank: 2, xu: 100 },
    { studentId: 'student-4', fullName: 'Phạm Duy', avatar: null, className: '5A', rank: 3, xu: 90 },
    { studentId: 'student-5', fullName: 'Vũ Hà', avatar: null, className: '5A', rank: 4, xu: 80 },
    { studentId: 'student-2', fullName: 'Trần Bình', avatar: null, className: '5A', rank: 7, xu: 52 },
  ],
  currentStudent: {
    studentId: 'student-2',
    fullName: 'Trần Bình',
    avatar: null,
    className: '5A',
    rank: 7,
    xu: 52,
    gapToNext: 8,
  },
  totalStudents: 8,
  period: 'week',
  scope: 'school',
  updatedAt: '2026-09-30T08:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  getStudentLeaderboardMock.mockReset();
  getStudentLeaderboardMock.mockResolvedValue(makeData());
  document.body.style.overflow = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StudentFloatingSidebar gold leaderboard', () => {
  it('fetches the weekly school view only after opening and renders the current row', async () => {
    render(<StudentFloatingSidebar />);

    expect(getStudentLeaderboardMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));

    const dialog = await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain('max-h-[85dvh]');
    await waitFor(() => expect(getStudentLeaderboardMock).toHaveBeenCalledWith({ scope: 'school', period: 'week' }));
    expect(screen.getAllByText('Trần Bình')).toHaveLength(2);
    expect(screen.getByText('Vị trí của em')).toBeInTheDocument();
    expect(screen.getByText('Còn 8 xu để vượt hạng 6')).toBeInTheDocument();
    expect(screen.getByText('Xu kiếm được trong tuần này')).toBeInTheDocument();
    expect(screen.getByText('Cập nhật lúc 15:00 hôm nay')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn An')).toBeInTheDocument();
  });

  it('maps the class tab to the all-time class request and keeps the dialog accessible', async () => {
    render(<StudentFloatingSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));
    await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });

    fireEvent.click(screen.getByRole('tab', { name: 'Lớp của em' }));

    await waitFor(() => expect(getStudentLeaderboardMock).toHaveBeenLastCalledWith({ scope: 'class', period: 'all' }));
    expect(screen.getByRole('tab', { name: 'Lớp của em' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Đóng bảng vàng' })).toBeInTheDocument();
  });

  it('keeps an additional tied rank-one student in the ranked list', async () => {
    getStudentLeaderboardMock.mockResolvedValueOnce(makeData({
      topStudents: [
        { studentId: 'tie-1', fullName: 'An Một', avatar: null, className: '5A', rank: 1, xu: 120 },
        { studentId: 'tie-2', fullName: 'Bình Hai', avatar: null, className: '5A', rank: 1, xu: 120 },
        { studentId: 'tie-3', fullName: 'Chi Ba', avatar: null, className: '5A', rank: 2, xu: 100 },
        { studentId: 'tie-4', fullName: 'Dũng Bốn', avatar: null, className: '5A', rank: 3, xu: 90 },
      ],
      currentStudent: null,
      totalStudents: 4,
    }));
    render(<StudentFloatingSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));
    await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });

    const tiedStudent = screen.getByText('Bình Hai');
    expect(tiedStudent.closest('article')).toBeNull();
    expect(tiedStudent.closest('li')).toBeInTheDocument();
    expect(screen.getByText('Chi Ba').closest('article')).toBeInTheDocument();
  });

  it('explains all-time views as current balance', async () => {
    getStudentLeaderboardMock.mockImplementation(async ({ period }: { period: 'week' | 'all' }) => (
      makeData({ period })
    ));
    render(<StudentFloatingSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));
    await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });
    fireEvent.click(screen.getByRole('tab', { name: 'Lớp của em' }));

    expect(await screen.findByText('Số xu hiện có trong tài khoản')).toBeInTheDocument();
  });

  it('formats update time as today or a full Vietnamese date in the Hanoi timezone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T08:00:00.000Z'));
    getStudentLeaderboardMock
      .mockResolvedValueOnce(makeData())
      .mockResolvedValueOnce(makeData({ updatedAt: '2026-09-29T08:00:00.000Z' }));
    render(<StudentFloatingSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));

    expect(await screen.findByText('Cập nhật lúc 15:00 hôm nay')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Lớp của em' }));

    expect(await screen.findByText('Cập nhật lúc 15:00 29/09/2026')).toBeInTheDocument();
  });

  it('keeps keyboard focus inside the modal when tabbing past either edge', async () => {
    render(<StudentFloatingSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));
    await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });

    const closeButton = screen.getByRole('button', { name: 'Đóng bảng vàng' });
    const tabs = screen.getAllByRole('tab');
    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(tabs[tabs.length - 1]);

    tabs[tabs.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
  });

  it('exposes restrained open and close motion states for reduced-motion aware animation', async () => {
    render(<StudentFloatingSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });
    const overlay = screen.getByRole('button', { name: 'Đóng lớp phủ bảng vàng' });

    expect(dialog).toHaveAttribute('data-motion', 'dialog');
    expect(overlay).toHaveAttribute('data-motion', 'backdrop');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng vàng' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Bảng vàng học sinh' })).not.toBeInTheDocument());
  });

  it('closes from Escape and restores body scrolling', async () => {
    render(<StudentFloatingSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));
    await screen.findByRole('dialog', { name: 'Bảng vàng học sinh' });
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Bảng vàng học sinh' })).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('');
  });

  it('shows retry after a failed request and an empty state when no students are returned', async () => {
    getStudentLeaderboardMock.mockRejectedValueOnce(new Error('Không thể tải bảng vàng.'));
    render(<StudentFloatingSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mở bảng vàng học sinh' }));

    expect(await screen.findByText('Không thể tải bảng vàng.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();

    getStudentLeaderboardMock.mockResolvedValueOnce(makeData({ topStudents: [], currentStudent: null, totalStudents: 0 }));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Bảng vàng đang chờ những người đầu tiên!')).toBeInTheDocument();
    expect(screen.getByText('Hãy làm bài và tích lũy xu nhé.')).toBeInTheDocument();
  });
});
