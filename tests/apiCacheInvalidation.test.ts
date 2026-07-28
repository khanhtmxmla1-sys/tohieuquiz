// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/api/config', () => ({ getWorkersApiBaseUrl: () => 'https://api.test' }));
vi.mock('../src/services/api/auth', () => ({ buildAuthHeaders: () => ({}) }));
vi.mock('../src/services/api/routeResolver', () => ({
  resolveApiRoute: () => ({ method: 'GET', auth: 'cookie', path: () => '/protected' }),
}));
vi.mock('../src/services/api/errors', () => ({
  toApiError: async (response: Response) => Object.assign(new Error('unauthorized'), { status: response.status }),
  normalizeNetworkError: (error: unknown) => error,
}));

import { executeApiAction } from '../src/services/api/apiClient';
import { cacheService } from '../src/services/CacheService';

describe('API cache invalidation', () => {
  beforeEach(() => {
    cacheService.setNamespace('student:test');
    cacheService.clear();
    vi.unstubAllGlobals();
  });

  it.each([401, 403])('clears account cache after HTTP %s', async (status) => {
    cacheService.set('results:student:test', { score: 10 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    await expect(executeApiAction('protected')).rejects.toMatchObject({ status });
    expect(cacheService.get('results:student:test')).toBeNull();
  });
});
