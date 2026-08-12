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

  it('returns 409 when a group is created from a stale suggestion', async () => {
    const all = vi.fn().mockResolvedValue({ results: [] });
    const bind = vi.fn().mockReturnValue({ all });
    const prepare = vi.fn().mockReturnValue({ bind });

    const response = await handleInterventionRoutes({
      request: new Request('https://example.test/api/results/interventions/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ suggestionKey: 'missing-suggestion' }),
      }),
      env: { DB: { prepare } } as any,
      user: { username: 'teacher-a', role: 'teacher' } as any,
      path: '/api/results/interventions/groups',
      method: 'POST',
    });

    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({
      status: 'error',
      message: 'Intervention suggestion is no longer available',
    });
  });

  it('returns assignment preview counts through the read-only route', async () => {
    const prepare = vi.fn((sql: string) => {
      const statement: any = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => {
          if (sql.includes('FROM intervention_groups')) return { id: 'group-1', class_id: 'class-1' };
          if (sql.includes('FROM quizzes')) return { id: 'quiz-1', title: 'Luyện tập phân số' };
          return null;
        }),
        all: vi.fn(async () => {
          if (sql.includes('FROM intervention_group_members')) {
            return { results: [{ student_id: 'student-1', full_name: 'Lan' }] };
          }
          if (sql.includes('FROM assignments')) return { results: [] };
          return { results: [] };
        }),
      };
      return statement;
    });

    const response = await handleInterventionRoutes({
      request: new Request('https://example.test/api/results/interventions/groups/group-1/assignments/preview?quizId=quiz-1'),
      env: { DB: { prepare } } as any,
      user: { username: 'teacher-a', role: 'teacher' } as any,
      path: '/api/results/interventions/groups/group-1/assignments/preview',
      method: 'GET',
    });

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      status: 'success',
      data: {
        groupId: 'group-1',
        quizId: 'quiz-1',
        memberCount: 1,
        openAssignmentCount: 0,
        assignableCount: 1,
      },
    });
  });});
