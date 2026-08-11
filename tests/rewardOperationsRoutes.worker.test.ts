import { describe, expect, it, vi } from 'vitest';

const { getRewardReconciliationReport, getSuspiciousRewardGrowthReport, rebuildCurrentWeekProgress } = vi.hoisted(() => ({
  getRewardReconciliationReport: vi.fn(async () => [
    { studentId: 'student-a', username: 'student-a', walletCoins: 130, ledgerCoins: 120, difference: 10 },
  ]),
  getSuspiciousRewardGrowthReport: vi.fn(async () => [
    { studentId: 'student-a', username: 'student-a', walletCoins: 130, coinsGrowth: 1200, rewardEvents: 9, largestSingleDelta: 500 },
  ]),
  rebuildCurrentWeekProgress: vi.fn(async () => ({
    weekKey: '2026-W33', scanned: 5, recorded: 4, alreadyRecorded: 1,
  })),
}));

vi.mock('../workers/src/gamification/rewardSecurityMaintenance', () => ({
  getRewardReconciliationReport,
  getSuspiciousRewardGrowthReport,
  rebuildCurrentWeekProgress,
}));
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async (request: Request) => ({
    user: { username: 'admin-a', role: request.headers.get('x-role') || 'admin' },
  })),
  requireAdmin: vi.fn((user: { role: string }) => user.role === 'admin'),
}));

import { handleOperationsRoutes } from '../workers/src/routes/operations';

const env = { DB: {} } as any;

describe('admin reward security operations', () => {
  it('exports read-only reconciliation and anomaly reports for admins', async () => {
    const response = await handleOperationsRoutes(
      new Request('https://api.test/api/admin/operations/rewards?sinceHours=48&thresholdCoins=1500&limit=25', {
        headers: { 'x-role': 'admin' },
      }),
      env,
      '/api/admin/operations/rewards',
      'GET',
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(payload.data.reconciliation).toHaveLength(1);
    expect(payload.data.suspiciousGrowth).toHaveLength(1);
    expect(payload.data.filters).toMatchObject({ sinceHours: 48, thresholdCoins: 1500, limit: 25 });
    expect(getRewardReconciliationReport).toHaveBeenCalledWith(env.DB, 25);
    expect(getSuspiciousRewardGrowthReport).toHaveBeenCalledWith(env.DB, expect.any(String), 1500, 25);
  });

  it('runs the idempotent current-week progress rebuild only through admin POST', async () => {
    const response = await handleOperationsRoutes(
      new Request('https://api.test/api/admin/operations/rewards/rebuild-current-week', {
        method: 'POST', headers: { 'x-role': 'admin' },
      }),
      env,
      '/api/admin/operations/rewards/rebuild-current-week',
      'POST',
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(200);
    expect(payload.data).toEqual({ weekKey: '2026-W33', scanned: 5, recorded: 4, alreadyRecorded: 1 });
    expect(rebuildCurrentWeekProgress).toHaveBeenCalledWith(env.DB);
  });

  it('rejects non-admin access and wrong methods', async () => {
    const forbidden = await handleOperationsRoutes(
      new Request('https://api.test/api/admin/operations/rewards', { headers: { 'x-role': 'teacher' } }),
      env,
      '/api/admin/operations/rewards',
      'GET',
    );
    expect(forbidden?.status).toBe(403);

    const wrongMethod = await handleOperationsRoutes(
      new Request('https://api.test/api/admin/operations/rewards/rebuild-current-week', { headers: { 'x-role': 'admin' } }),
      env,
      '/api/admin/operations/rewards/rebuild-current-week',
      'GET',
    );
    expect(wrongMethod?.status).toBe(405);
  });
});
