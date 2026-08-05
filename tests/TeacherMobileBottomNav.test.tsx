import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeacherMobileBottomNav from '../src/components/TeacherDashboard/teacher-dashboard-shell/TeacherMobileBottomNav';

describe('TeacherMobileBottomNav', () => {
  it('maps the four primary destinations and opens the remaining navigation', () => {
    const onSelectTab = vi.fn();
    const onOpenMore = vi.fn();

    render(
      <TeacherMobileBottomNav
        activeTab="overview"
        onSelectTab={onSelectTab}
        onOpenMore={onOpenMore}
      />,
    );

    expect(screen.getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Đề thi' }));
    expect(onSelectTab).toHaveBeenCalledWith('manage');
    fireEvent.click(screen.getByRole('button', { name: 'Học sinh' }));
    expect(onSelectTab).toHaveBeenCalledWith('classes');
    fireEvent.click(screen.getByRole('button', { name: 'Kết quả' }));
    expect(onSelectTab).toHaveBeenCalledWith('results');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm' }));
    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });

  it('marks the matching route as current and keeps labels visible', () => {
    render(
      <TeacherMobileBottomNav
        activeTab="results"
        onSelectTab={vi.fn()}
        onOpenMore={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Kết quả' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
});
