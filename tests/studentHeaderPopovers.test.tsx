import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationItems = vi.hoisted(() => ({
  value: [
    {
      id: 'notification-1',
      type: 'certificate_issued',
      title: 'Bạn có quà thưởng mới',
      body: 'Chúc mừng',
      data: { certificate_id: 'certificate-1' },
      is_read: false,
      created_at: '2026-09-23T06:12:00.000Z',
    },
  ] as any[],
}));

vi.mock('../src/hooks/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({
    notifications: notificationItems.value,
    isLoading: false,
    markAsRead: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { StudentDashboardHeader } from '../src/components/HomePage/student-dashboard/StudentDashboardHeader';

const renderHeader = () => render(
  <StudentDashboardHeader
    studentName="Hà Minh Khang"
    className="3A1"
    avatarUrl="/avatar1.png"
    level={3}
    coins={165}
    activeSection="dashboard"
    giftShopEnabled
    competitionEnabled={false}
    studentId="student-1"
    unifiedNotificationsReady
    unifiedNotificationsEnabled={false}
    onSelectSection={vi.fn()}
    onOpenAssignments={vi.fn()}
    onOpenPractice={vi.fn()}
    onOpenAssignment={vi.fn()}
    onOpenResultReport={vi.fn()}
    onOpenGiftShop={vi.fn()}
    onOpenLiveExam={vi.fn()}
    onOpenAvatar={vi.fn()}
    onOpenChangePassword={vi.fn()}
    onClearDeviceData={vi.fn()}
    onLogout={vi.fn()}
  />,
);

describe('student header popovers', () => {
  beforeEach(() => {
    notificationItems.value = [
      {
        id: 'notification-1',
        type: 'certificate_issued',
        title: 'Bạn có quà thưởng mới',
        body: 'Chúc mừng',
        data: { certificate_id: 'certificate-1' },
        is_read: false,
        created_at: '2026-09-23T06:12:00.000Z',
      },
    ];
  });

  it('closes the account menu when clicking outside it', () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /Mở menu tài khoản/i }));
    expect(screen.getByRole('menu', { name: 'Tài khoản học sinh' })).toBeVisible();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu', { name: 'Tài khoản học sinh' })).not.toBeInTheDocument();
  });

  it('closes the legacy notification popover when clicking outside it', () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /Thông báo, 1 chưa đọc/i }));
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeVisible();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).not.toBeInTheDocument();
  });

  it('keeps the notification and account popovers mutually exclusive', () => {
    renderHeader();
    const notificationTrigger = screen.getByRole('button', { name: /Thông báo, 1 chưa đọc/i });
    const accountTrigger = screen.getByRole('button', { name: /Mở menu tài khoản/i });

    fireEvent.click(notificationTrigger);
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeVisible();

    fireEvent.mouseDown(accountTrigger);
    fireEvent.click(accountTrigger);
    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).not.toBeInTheDocument();
    expect(screen.getByRole('menu', { name: 'Tài khoản học sinh' })).toBeVisible();

    fireEvent.mouseDown(notificationTrigger);
    fireEvent.click(notificationTrigger);
    expect(screen.queryByRole('menu', { name: 'Tài khoản học sinh' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeVisible();
  });

  it('closes the legacy notification popover with Escape', () => {
    renderHeader();

    const notificationTrigger = screen.getByRole('button', { name: /Thông báo, 1 chưa đọc/i });
    fireEvent.click(notificationTrigger);
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).not.toBeInTheDocument();
    expect(notificationTrigger).toHaveFocus();
  });
});
