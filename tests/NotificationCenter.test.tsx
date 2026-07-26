import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxNotification } from '../shared/notifications.contract';

const inbox = vi.hoisted(() => ({
  value: {} as any,
}));

vi.mock('../src/features/notifications/useNotificationInbox', () => ({
  useNotificationInbox: () => inbox.value,
}));

import { NotificationCenter } from '../src/features/notifications/components';

const notification = (
  id: string,
  isRead: boolean,
  title: string,
): InboxNotification => ({
  id,
  type: 'assignment_created',
  priority: 'INFO',
  title,
  body: 'Nội dung',
  actionUrl: null,
  data: { assignment_id: `assignment-${id}` },
  isRead,
  createdAt: '2026-07-24T00:00:00.000Z',
  expiresAt: null,
});

describe('NotificationCenter', () => {
  beforeEach(() => {
    inbox.value = {
      items: [
        notification('one', false, 'Bài mới'),
        notification('two', true, 'Đã đọc'),
      ],
      unreadCount: 1,
      isLoading: false,
      isRefreshing: false,
      isStale: false,
      error: null,
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn(),
    };
  });

  it('announces unread count, filters unread, and marks all read', async () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }));

    fireEvent.click(screen.getByRole('button', { name: 'Chưa đọc' }));
    expect(screen.getByText('Bài mới')).toBeInTheDocument();
    expect(screen.queryByText('Đã đọc')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }));
    await waitFor(() => expect(inbox.value.markAllRead).toHaveBeenCalled());
  });

  it('closes on Escape, restores focus, and closes on outside click', () => {
    render(<NotificationCenter />);
    const trigger = screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).not.toBeInTheDocument();
  });

  it('marks an item read before navigating to its typed target', async () => {
    const onNavigate = vi.fn();
    render(<NotificationCenter onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    fireEvent.click(screen.getByRole('button', { name: /Bài mới/ }));

    await waitFor(() => expect(inbox.value.markRead).toHaveBeenCalledWith('one'));
    expect(onNavigate).toHaveBeenCalledWith({
      kind: 'assignment',
      assignmentId: 'assignment-one',
    });
  });

  it('renders a bottom sheet on mobile', () => {
    render(<NotificationCenter forceMobile />);
    fireEvent.click(screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    expect(screen.getByRole('dialog', { name: 'Thông báo' }))
      .toHaveAttribute('data-variant', 'bottom-sheet');
  });
});
