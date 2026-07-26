import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../services/api/errors';

const service = vi.hoisted(() => ({
  getSession: vi.fn(),
  login: vi.fn(),
  activate: vi.fn(),
  logout: vi.fn(),
  getDashboard: vi.fn(),
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('../parentPortalService', () => service);

import { useParentPortalStore } from '../useParentPortalStore';

const student = { id: 'student-1', fullName: 'Nguyễn Văn An', className: '4A9', avatar: '' };
const notification = {
  id: 'n-1', kind: 'quiz_result' as const, title: 'Kết quả', body: '8/10',
  payload: {}, isImportant: false, isRead: false,
  publishedAt: '2026-07-22T00:00:00.000Z', expiresAt: null,
};

const reset = () => useParentPortalStore.setState({
  session: null,
  dashboard: null,
  notifications: [],
  unreadCount: 0,
  isRestoring: false,
  isLoading: false,
  error: null,
});

describe('parent portal store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
  });

  it('always restores from the server and never depends on persisted state', async () => {
    service.getSession.mockResolvedValue({ student });
    await useParentPortalStore.getState().restoreSession();

    expect(service.getSession).toHaveBeenCalledTimes(1);
    expect(useParentPortalStore.getState()).toMatchObject({ session: student, isRestoring: false, error: null });
    expect(localStorage.getItem('parent-portal-storage')).toBeNull();
  });

  it('logs in and activates into the same in-memory session state', async () => {
    service.login.mockResolvedValue({ student });
    service.activate.mockResolvedValue({ student });

    await expect(useParentPortalStore.getState().login('ABCDEFG234', '123456')).resolves.toBe(true);
    expect(useParentPortalStore.getState().session).toEqual(student);

    reset();
    await expect(useParentPortalStore.getState().activate('token', '123456')).resolves.toBe(true);
    expect(useParentPortalStore.getState().session).toEqual(student);
  });

  it('loads dashboard and notifications and updates read state optimistically after success', async () => {
    useParentPortalStore.setState({ session: student });
    service.getDashboard.mockResolvedValue({
      student, period: { weekStart: '2026-07-20', weekEnd: '2026-07-26', previousWeekStart: '2026-07-13' },
      metrics: { completedQuizzes: 1, averageScore: 8, learningSeconds: 60, correctRate: 80, pendingAssignments: 0, unreadNotifications: 1 },
      comparison: { averageScoreDelta: 0, completedQuizzesDelta: 1 },
      subjects: [], recentActivity: [], recommendations: [], importantNotifications: [],
    });
    service.listNotifications.mockResolvedValue({ items: [notification], nextCursor: null, unreadCount: 1 });
    service.markNotificationRead.mockResolvedValue({ id: 'n-1', isRead: true });

    await useParentPortalStore.getState().loadDashboard('2026-07-20');
    await useParentPortalStore.getState().loadNotifications();
    await useParentPortalStore.getState().markNotificationRead('n-1');

    expect(useParentPortalStore.getState().dashboard?.metrics.averageScore).toBe(8);
    expect(useParentPortalStore.getState().notifications[0].isRead).toBe(true);
    expect(useParentPortalStore.getState().unreadCount).toBe(0);
  });

  it('clears all protected data after any parent endpoint returns 401', async () => {
    useParentPortalStore.setState({ session: student, notifications: [notification], unreadCount: 1 });
    service.getDashboard.mockRejectedValue(new ApiError('Expired', 401, 'PARENT_SESSION_INVALID'));

    await useParentPortalStore.getState().loadDashboard();

    expect(useParentPortalStore.getState()).toMatchObject({
      session: null, dashboard: null, notifications: [], unreadCount: 0,
    });
  });

  it('logs out even when the network request fails', async () => {
    useParentPortalStore.setState({ session: student });
    service.logout.mockRejectedValue(new Error('offline'));

    await useParentPortalStore.getState().logout();

    expect(useParentPortalStore.getState().session).toBeNull();
  });
});
