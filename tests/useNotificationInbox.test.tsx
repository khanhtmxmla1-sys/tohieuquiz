import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxNotification } from '../shared/notifications.contract';

const service = vi.hoisted(() => ({
  fetchNotificationInbox: vi.fn(),
  readNotification: vi.fn(),
  readAllNotifications: vi.fn(),
}));

vi.mock('../src/features/notifications/notificationService', () => service);

import { useNotificationInbox } from '../src/features/notifications/useNotificationInbox';

const item = (id: string, isRead = false): InboxNotification => ({
  id,
  type: 'system',
  priority: 'INFO',
  severity: 'informational',
  title: `Thông báo ${id}`,
  body: null,
  actionUrl: null,
  data: {},
  isRead,
  createdAt: '2026-07-24T00:00:00.000Z',
  availableAt: '2026-07-24T00:00:00.000Z',
  expiresAt: null,
});

const setVisibility = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

const flushRequests = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useNotificationInbox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    service.fetchNotificationInbox.mockReset();
    service.readNotification.mockReset();
    service.readAllNotifications.mockReset();
    service.fetchNotificationInbox.mockResolvedValue({
      items: [item('one')],
      nextCursor: null,
      unreadCount: 1,
    });
    service.readNotification.mockResolvedValue(undefined);
    service.readAllNotifications.mockResolvedValue(undefined);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches immediately and polls every 30 seconds while visible', async () => {
    const { result } = renderHook(() => useNotificationInbox());

    await flushRequests();
    expect(result.current.items).toHaveLength(1);
    expect(service.fetchNotificationInbox).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(service.fetchNotificationInbox).toHaveBeenCalledTimes(2);
  });

  it('does not poll while hidden and refreshes immediately when visible again', async () => {
    const { result } = renderHook(() => useNotificationInbox());
    await flushRequests();
    expect(result.current.items).toHaveLength(1);

    act(() => setVisibility('hidden'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(service.fetchNotificationInbox).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    await flushRequests();
    expect(service.fetchNotificationInbox).toHaveBeenCalledTimes(2);
  });

  it('keeps existing items, marks stale and increases retry backoff after errors', async () => {
    const { result } = renderHook(() => useNotificationInbox());
    await flushRequests();
    expect(result.current.items).toHaveLength(1);
    service.fetchNotificationInbox.mockRejectedValue(new Error('offline'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.isStale).toBe(true);
    expect(result.current.error).toBe('offline');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(service.fetchNotificationInbox).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(service.fetchNotificationInbox).toHaveBeenCalledTimes(3);
  });

  it('keeps one notification unread until the server confirms the update', async () => {
    service.readNotification.mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() => useNotificationInbox());
    await flushRequests();
    expect(result.current.unreadCount).toBe(1);

    let confirmed = true;
    await act(async () => {
      confirmed = await result.current.markRead('one');
    });
    expect(confirmed).toBe(false);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.items[0].isRead).toBe(false);
  });

  it('keeps all notifications unread until the server confirms the update', async () => {
    service.fetchNotificationInbox.mockResolvedValue({
      items: [item('one'), item('two')],
      nextCursor: null,
      unreadCount: 2,
    });
    service.readAllNotifications.mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() => useNotificationInbox());
    await flushRequests();
    expect(result.current.unreadCount).toBe(2);

    let confirmed = true;
    await act(async () => {
      confirmed = await result.current.markAllRead();
    });
    expect(confirmed).toBe(false);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.items.every((notification) => !notification.isRead)).toBe(true);
  });
});
