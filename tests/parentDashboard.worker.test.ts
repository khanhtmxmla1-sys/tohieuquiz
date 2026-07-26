// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  resolveIctWeekWindow,
  type ParentDashboardService,
} from '../workers/src/parentPortal/dashboardService';
import {
  handleParentDashboardRoutes,
  type ParentDashboardRouteRuntime,
} from '../workers/src/routes/parentPortal/dashboardRoutes';

const dashboard = {
  student: { id: 'student-a', fullName: 'An', className: '4A', avatar: '' },
  period: { weekStart: '2026-07-20', weekEnd: '2026-07-26', previousWeekStart: '2026-07-13' },
  metrics: {
    completedQuizzes: 2, averageScore: 8, learningSeconds: 600,
    correctRate: 80, pendingAssignments: 1, unreadNotifications: 3,
  },
  comparison: { averageScoreDelta: 1, completedQuizzesDelta: 1 },
  subjects: [], recentActivity: [], recommendations: ['Cùng con hoàn thành 1 bài tập đang chờ.'],
  importantNotifications: [],
};

const runtime = (loadDashboard = vi.fn(async () => dashboard)): ParentDashboardRouteRuntime => ({
  authenticate: vi.fn(async () => ({ linkId: 'link-a', studentId: 'student-a', tokenVersion: 1 })),
  service: { loadDashboard } as ParentDashboardService,
  now: () => new Date('2026-07-22T00:00:00.000Z'),
});

describe('ICT week windows', () => {
  it('resolves Monday through Sunday in Asia/Ho_Chi_Minh', () => {
    expect(resolveIctWeekWindow('2026-07-20')).toEqual({
      weekStart: '2026-07-20',
      weekEnd: '2026-07-26',
      previousWeekStart: '2026-07-13',
      currentStartUtc: '2026-07-19T17:00:00.000Z',
      currentEndUtc: '2026-07-26T17:00:00.000Z',
      previousStartUtc: '2026-07-12T17:00:00.000Z',
    });
  });

  it('rejects invalid dates and non-Mondays', () => {
    expect(() => resolveIctWeekWindow('2026-02-30')).toThrow(/weekStart/i);
    expect(() => resolveIctWeekWindow('2026-07-21')).toThrow(/Monday/i);
  });
});

describe('parent dashboard route isolation', () => {
  it('ignores a spoofed studentId and always uses the parent session student', async () => {
    const loadDashboard = vi.fn(async () => dashboard);
    const response = await handleParentDashboardRoutes(
      new Request('https://phuhuynh.thtohieu.com/api/parent/dashboard?studentId=student-b&weekStart=2026-07-20'),
      { DB: {} } as any,
      '/api/parent/dashboard',
      'GET',
      runtime(loadDashboard),
    );

    expect(response?.status).toBe(200);
    expect(loadDashboard).toHaveBeenCalledWith(
      'student-a',
      expect.objectContaining({ weekStart: '2026-07-20' }),
      new Date('2026-07-22T00:00:00.000Z'),
    );
  });

  it('returns 400 for an invalid requested week', async () => {
    const response = await handleParentDashboardRoutes(
      new Request('https://phuhuynh.thtohieu.com/api/parent/dashboard?weekStart=2026-07-21'),
      { DB: {} } as any,
      '/api/parent/dashboard',
      'GET',
      runtime(),
    );
    expect(response?.status).toBe(400);
  });
});
