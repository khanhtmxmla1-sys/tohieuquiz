import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AssignmentTrackingSection from '../src/components/TeacherDashboard/AssignmentTrackingSection';

const assignments = [
  {
    id: 'later',
    quizId: 'quiz-2',
    quizTitle: 'Bài hạn sau',
    classId: 'class-4a',
    className: '4A',
    deadline: '2026-08-10T16:59:00.000Z',
    status: 'OPEN',
    createdAt: '2026-07-23T00:00:00.000Z',
    submittedCount: 2,
    totalStudents: 30,
  },
  {
    id: 'urgent',
    quizId: 'quiz-1',
    quizTitle: 'Bài sắp đến hạn',
    classId: 'class-4a',
    className: '4A',
    deadline: '2026-07-29T08:00:00.000Z',
    status: 'OPEN',
    createdAt: '2026-07-22T00:00:00.000Z',
    submittedCount: 5,
    totalStudents: 30,
  },
] as any;

const renderSection = (initialEntry = '/teacher/assignments') => {
  window.history.replaceState({}, '', initialEntry);
  return render(
    <AssignmentTrackingSection
      assignments={assignments}
      onDelete={vi.fn()}
      onUpdateDeadline={vi.fn().mockResolvedValue(true)}
      onUpdateStatus={vi.fn().mockResolvedValue(true)}
      isLoading={false}
    />,
  );
};

describe('AssignmentTrackingSection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers search/status controls, sorts open assignments by nearest deadline, and exposes edit labels', () => {
    renderSection();

    expect(screen.getByRole('searchbox', { name: 'Tìm bài đã giao' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Lọc trạng thái bài giao' })).toBeTruthy();

    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Bài sắp đến hạn')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Sửa hạn nộp' }).length).toBeGreaterThan(0);
  });

  it('uses the normalized Hanoi ISO deadline when deciding whether to reopen a closed assignment', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T18:00:00.000Z'));
    const onUpdateDeadline = vi.fn().mockResolvedValue(true);
    const onUpdateStatus = vi.fn().mockResolvedValue(true);
    render(
      <AssignmentTrackingSection
        assignments={[{ ...assignments[0], id: 'closed', status: 'CLOSED' }]}
        onRevoke={vi.fn()}
        onUpdateDeadline={onUpdateDeadline}
        onUpdateStatus={onUpdateStatus}
        isLoading={false}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Mở lại bài giao' })[0]);
    const deadlineInput = screen.getAllByLabelText('Hạn nộp theo giờ Hà Nội GMT+7')[0];
    fireEvent.change(deadlineInput, { target: { value: '2026-08-05T00:30' } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Lưu hạn nộp' })[0]);
      await Promise.resolve();
    });

    expect(onUpdateDeadline).toHaveBeenCalledWith(
      'closed',
      '2026-08-04T17:30:00.000Z',
    );
    expect(onUpdateStatus).not.toHaveBeenCalled();
  });

  it('applies the Action Center status/due filter from the URL and keeps changes in the URL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T08:00:00.000Z'));
    renderSection('/teacher/assignments?status=OPEN&due=48');

    expect(screen.getByRole('combobox', { name: 'Lọc trạng thái bài giao' })).toHaveValue('OPEN');
    expect(screen.getByText('Bài sắp đến hạn')).toBeInTheDocument();
    expect(screen.queryByText('Bài hạn sau')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Lọc trạng thái bài giao' }), {
      target: { value: 'CLOSED' },
    });
    expect(`${window.location.pathname}${window.location.search}`).toBe('/teacher/assignments?status=CLOSED&due=48');
  });
});
