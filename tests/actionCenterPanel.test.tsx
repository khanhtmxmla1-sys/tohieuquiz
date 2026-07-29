import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchTeacherActionCenterMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/teacherActionCenterService', () => ({
  fetchTeacherActionCenter: fetchTeacherActionCenterMock,
}));

import ActionCenterPanel from '../src/components/TeacherDashboard/overview/ActionCenterPanel';

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
};

const renderPanel = () => render(
  <MemoryRouter initialEntries={['/teacher/overview']}>
    <ActionCenterPanel />
    <LocationProbe />
  </MemoryRouter>,
);

describe('ActionCenterPanel', () => {
  beforeEach(() => {
    fetchTeacherActionCenterMock.mockReset();
  });

  it('renders scoped actions and navigates to the exact internal filter URL', async () => {
    fetchTeacherActionCenterMock.mockResolvedValue({
      generatedAt: '2026-07-28T08:00:00.000Z',
      items: [{
        id: 'assignment-at-risk',
        kind: 'assignment_at_risk',
        severity: 'critical',
        title: 'Bài giao sắp đến hạn',
        explanation: '2 bài còn 7 học sinh chưa nộp trong 48 giờ tới.',
        count: 2,
        generatedAt: '2026-07-28T08:00:00.000Z',
        cta: {
          label: 'Xem bài cần xử lý',
          url: '/teacher/assignments?status=OPEN&due=48',
        },
      }],
    });

    renderPanel();

    expect(await screen.findByText('Bài giao sắp đến hạn')).toBeInTheDocument();
    expect(screen.getByText(/7 học sinh chưa nộp/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Xem bài cần xử lý/i }));
    expect(screen.getByTestId('location')).toHaveTextContent('/teacher/assignments?status=OPEN&due=48');
  });

  it('renders the low-stock action without breaking the remaining action list', async () => {
    fetchTeacherActionCenterMock.mockResolvedValue({
      generatedAt: '2026-07-28T08:00:00.000Z',
      items: [
        {
          id: 'gift-low-stock',
          kind: 'gift_low_stock',
          severity: 'warning',
          title: 'Phần thưởng sắp hết hàng',
          explanation: '1 phần thưởng đã chạm ngưỡng tồn kho thấp.',
          count: 1,
          generatedAt: '2026-07-28T08:00:00.000Z',
          cta: {
            label: 'Kiểm tra tồn kho',
            url: '/teacher/gift-shop?tab=catalog&stock=low',
          },
        },
        {
          id: 'drafts-unpublished',
          kind: 'draft_unpublished',
          severity: 'info',
          title: 'Bản nháp chưa hoàn tất',
          explanation: '1 bản nháp cần tiếp tục.',
          count: 1,
          generatedAt: '2026-07-28T08:00:00.000Z',
          cta: {
            label: 'Tiếp tục bản nháp',
            url: '/teacher/quizzes/manual/new?draftId=draft-latest',
          },
        },
      ],
    });

    renderPanel();

    expect(await screen.findByText('Phần thưởng sắp hết hàng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kiểm tra tồn kho/i })).toHaveAttribute(
      'href',
      '/teacher/gift-shop?tab=catalog&stock=low',
    );
    expect(screen.getByRole('link', { name: /Tiếp tục bản nháp/i })).toBeInTheDocument();
  });

  it('shows a calm empty state when no work is urgent', async () => {
    fetchTeacherActionCenterMock.mockResolvedValue({
      generatedAt: '2026-07-28T08:00:00.000Z',
      items: [],
    });

    renderPanel();

    expect(await screen.findByText('Không có việc gấp trong phạm vi hiện tại')).toBeInTheDocument();
  });

  it('keeps a retry surface when the request fails', async () => {
    fetchTeacherActionCenterMock.mockRejectedValue(new Error('Mạng tạm thời gián đoạn'));

    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent('Mạng tạm thời gián đoạn');
    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeEnabled();
  });
});
