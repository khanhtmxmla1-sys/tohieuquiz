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
  title: `Thông báo ${id}`,
  body: null,
  actionUrl: null,
  data: {},
  isRead,
  createdAt: '2026-07-24T00:00:00.000Z',
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

  it('optimistically marks one notification read and rolls back on failure', async () => {
    service.readNotification.mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() => useNotificationInbox());
    await flushRequests();
    expect(result.current.unreadCount).toBe(1);

    let pending: Promise<void>;
    act(() => {
      pending = result.current.markRead('one');
    });
    expect(result.current.unreadCount).toBe(0);
    await act(async () => {
      await pending!;
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it('optimistically marks all notifications read and rolls back on failure', async () => {
    service.fetchNotificationInbox.mockResolvedValue({
      items: [item('one'), item('two')],
      nextCursor: null,
    });
    service.readAllNotifications.mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() => useNotificationInbox());
    await flushRequests();
    expect(result.current.unreadCount).toBe(2);

    let pending: Promise<void>;
    act(() => {
      pending = result.current.markAllRead();
    });
    expect(result.current.unreadCount).toBe(0);
    await act(async () => {
      await pending!;
    });
    expect(result.current.unreadCount).toBe(2);
  });
});
