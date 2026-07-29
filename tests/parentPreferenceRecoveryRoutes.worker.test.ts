// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ParentAccountService } from '../workers/src/parentPortal/accountService';
import {
  handleParentPreferenceRecoveryRoutes,
  type ParentPreferenceRecoveryRouteRuntime,
} from '../workers/src/routes/parentPortal/preferenceRecoveryRoutes';

const preferences = {
  email: 'parent@example.com',
  emailVerifiedAt: null,
  weeklyDigestEnabled: false,
  digestWeekday: 1 as const,
  digestHour: 19,
  timezone: 'Asia/Ho_Chi_Minh' as const,
  quietHoursEnabled: true,
  quietHoursStart: '21:00',
  quietHoursEnd: '07:00',
  emailKinds: ['quiz_result' as const],
  emailRolloutReady: true,
  updatedAt: null,
};

const makeRuntime = () => {
  const account: ParentAccountService = {
    getPreferences: vi.fn(async () => preferences),
    updatePreferences: vi.fn(async () => preferences),
    requestEmailVerification: vi.fn(async () => ({ requested: true as const })),
    verifyEmail: vi.fn(async () => ({ verified: true as const })),
    requestRecovery: vi.fn(async () => ({ requested: true as const })),
    confirmRecovery: vi.fn(async () => ({ reset: true as const })),
  };
  const runtime: ParentPreferenceRecoveryRouteRuntime = {
    authenticate: vi.fn(async () => ({ linkId: 'link-session', studentId: 'student-session', tokenVersion: 1, purpose: 'parent_session' as const })),
    account,
    now: () => new Date('2026-07-29T08:00:00.000Z'),
  };
  return { runtime, account };
};

const request = (path: string, method: string, body?: Record<string, unknown>) => new Request(
  `https://phuhuynh.test${path}`,
  {
    method,
    headers: { 'Content-Type': 'application/json', 'x-request-id': 'route-request' },
    body: body ? JSON.stringify(body) : undefined,
  },
);

describe('parent preference and recovery routes', () => {
  it('derives the link from the parent session and ignores spoofed identifiers', async () => {
    const { runtime, account } = makeRuntime();
    const response = await handleParentPreferenceRecoveryRoutes(
      request('/api/parent/preferences', 'PUT', {
        ...preferences,
        linkId: 'other-link',
      }),
      {} as any,
      '/api/parent/preferences',
      'PUT',
      runtime,
    );

    expect(response?.status).toBe(200);
    expect(account.updatePreferences).toHaveBeenCalledWith(
      'link-session',
      expect.objectContaining({ linkId: 'other-link' }),
      new Date('2026-07-29T08:00:00.000Z'),
      'route-request',
    );
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
  });

  it('keeps recovery request public and returns a generic accepted response', async () => {
    const { runtime, account } = makeRuntime();
    const response = await handleParentPreferenceRecoveryRoutes(
      request('/api/parent/recovery/request', 'POST', { accessCode: 'ABCDEFG234', email: 'parent@example.com' }),
      {} as any,
      '/api/parent/recovery/request',
      'POST',
      runtime,
    );

    expect(response?.status).toBe(202);
    expect(runtime.authenticate).not.toHaveBeenCalled();
    expect(account.requestRecovery).toHaveBeenCalledWith(
      'ABCDEFG234', 'parent@example.com', expect.any(Date), 'route-request',
    );
    await expect(response?.json()).resolves.toEqual({ data: { requested: true } });
  });

  it('clears any old parent cookie after a successful PIN reset', async () => {
    const { runtime } = makeRuntime();
    const response = await handleParentPreferenceRecoveryRoutes(
      request('/api/parent/recovery/confirm', 'POST', { token: 'one-time', pin: '654321' }),
      {} as any,
      '/api/parent/recovery/confirm',
      'POST',
      runtime,
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Set-Cookie')).toContain('parent_auth_token=');
    expect(response?.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});
