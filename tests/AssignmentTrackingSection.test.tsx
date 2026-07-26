import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    id: 'sooner',
    quizId: 'quiz-1',
    quizTitle: 'Bài sắp đến hạn',
    classId: 'class-4a',
    className: '4A',
    deadline: '2026-08-01T16:59:00.000Z',
    status: 'OPEN',
    createdAt: '2026-07-22T00:00:00.000Z',
    submittedCount: 5,
    totalStudents: 30,
  },
] as any;

describe('AssignmentTrackingSection', () => {
  it('offers search/status controls, sorts open assignments by nearest deadline, and exposes edit labels', () => {
    render(
      <AssignmentTrackingSection
        assignments={assignments}
        onDelete={vi.fn()}
        onUpdateDeadline={vi.fn().mockResolvedValue(true)}
        onUpdateStatus={vi.fn().mockResolvedValue(true)}
        isLoading={false}
      />,
    );

    expect(screen.getByRole('searchbox', { name: 'Tìm bài đã giao' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Lọc trạng thái bài giao' })).toBeTruthy();

    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Bài sắp đến hạn')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Sửa hạn nộp' }).length).toBeGreaterThan(0);
  });
});
