import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import ParentNotificationsPage from '../src/features/parent-portal/pages/ParentNotificationsPage';
import { useParentPortalStore } from '../src/features/parent-portal/useParentPortalStore';

const service = vi.hoisted(() => ({ markAllNotificationsRead: vi.fn() }));
vi.mock('../src/features/parent-portal/parentPortalService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/parent-portal/parentPortalService')>(),
  markAllNotificationsRead: service.markAllNotificationsRead,
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};
const base = {
  title: 'Thông báo', body: 'Nội dung', payload: {}, isImportant: false,
  publishedAt: '2026-07-22T00:00:00.000Z', expiresAt: null,
};

describe('ParentNotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParentPortalStore.setState({
      notifications: [
        { ...base, id: 'n-1', kind: 'quiz_result', title: 'Có kết quả mới', payload: { resultId: 'result-1' }, isRead: false },
        { ...base, id: 'n-2', kind: 'certificate_issued', title: 'Chứng nhận mới', isRead: true },
        { ...base, id: 'n-3', kind: 'homework_assigned', title: 'Đã thu hồi', isRead: false, revokedAt: '2026-07-22T01:00:00.000Z' } as any,
      ],
      unreadCount: 2,
      isLoading: false,
      error: null,
      loadNotifications: vi.fn(async () => undefined),
      markNotificationRead: vi.fn(async () => undefined),
    });
    service.markAllNotificationsRead.mockResolvedValue({ updatedCount: 2 });
  });

  it('filters stale revoked items and marks a result read before navigation', async () => {
    const markNotificationRead = useParentPortalStore.getState().markNotificationRead as ReturnType<typeof vi.fn>;
    render(<MemoryRouter initialEntries={['/notifications']}><ParentNotificationsPage /><LocationProbe /></MemoryRouter>);

    expect(screen.getByText('Có kết quả mới')).toBeInTheDocument();
    expect(screen.queryByText('Đã thu hồi')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Có kết quả mới/ }));

    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('n-1'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/results/result-1'));
  });

  it('marks all notifications read and refreshes the feed', async () => {
    const loadNotifications = useParentPortalStore.getState().loadNotifications as ReturnType<typeof vi.fn>;
    render(<MemoryRouter><ParentNotificationsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }));

    await waitFor(() => expect(service.markAllNotificationsRead).toHaveBeenCalledTimes(1));
    expect(loadNotifications).toHaveBeenCalled();
  });
});
