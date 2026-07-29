import { describe, expect, it } from 'vitest';
import { handleInterventionRoutes } from '../workers/src/routes/interventions';

describe('Results Intervention routes', () => {
  it('ignores non-intervention result paths', async () => {
    const response = await handleInterventionRoutes({
      request: new Request('https://example.test/api/results'),
      env: { DB: {} } as any,
      user: { username: 'teacher-a', role: 'teacher' } as any,
      path: '/api/results',
      method: 'GET',
    });

    expect(response).toBeNull();
  });

  it.each(['student', 'admin'] as const)('rejects %s access before touching D1', async (role) => {
    const response = await handleInterventionRoutes({
      request: new Request('https://example.test/api/results/interventions'),
      env: { DB: {} } as any,
      user: { username: `${role}-a`, role } as any,
      path: '/api/results/interventions',
      method: 'GET',
    });

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      status: 'error',
      message: 'Forbidden: Teacher access required',
    });
  });
});
