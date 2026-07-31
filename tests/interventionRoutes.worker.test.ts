import { describe, expect, it, vi } from 'vitest';
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

  it('rejects student access before touching D1', async () => {
    const response = await handleInterventionRoutes({
      request: new Request('https://example.test/api/results/interventions'),
      env: { DB: {} } as any,
      user: { username: 'student-a', role: 'student' } as any,
      path: '/api/results/interventions',
      method: 'GET',
    });

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      status: 'error',
      message: 'Forbidden: Teacher access required',
    });
  });

  it.each(['teacher', 'admin'] as const)('allows %s to load the intervention dashboard', async (role) => {
    const all = vi.fn().mockResolvedValue({ results: [] });
    const bind = vi.fn().mockReturnValue({ all });
    const prepare = vi.fn().mockReturnValue({ bind });

    const response = await handleInterventionRoutes({
      request: new Request('https://example.test/api/results/interventions'),
      env: { DB: { prepare } } as any,
      user: { username: `${role}-a`, role } as any,
      path: '/api/results/interventions',
      method: 'GET',
    });

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      status: 'success',
      data: {
        suggestions: [],
        groups: [],
      },
    });
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
