import { describe, expect, it, vi } from 'vitest';
import { createWorkerFetch } from '../workers/src/router/createWorkerFetch';

const nullRoute = vi.fn(async () => null as Response | null);

describe('Competition public router order', () => {
  it('dispatches the public namespace before JWT and authenticated Competition routes', async () => {
    const verifyToken = vi.fn(() => new Response('unauthorized', { status: 401 }));
    const handlePublicCompetitionRoutes = vi.fn(async () => new Response('{"status":"success"}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const handleCompetitionRoutes = vi.fn(async () => new Response('{}'));
    const fetch = createWorkerFetch({
      handleCors: () => null,
      corsHeaders: () => ({}),
      enforceOriginGuard: () => null,
      verifyToken,
      jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
      errorResponse: (message: string, status = 400) => Response.json({ status: 'error', message }, { status }),
      internalErrorResponse: () => Response.json({ status: 'error' }, { status: 500 }),
      rateLimit: async () => null,
      handlePhieuSubdomain: nullRoute,
      handlePublicPhieuApi: nullRoute,
      handlePublicCompetitionRoutes,
      handleCompetitionRoutes,
      handleParentPortalRoutes: async () => new Response('not found', { status: 404 }),
    } as any);

    const response = await fetch(
      new Request('https://api.thtohieu.com/api/public/competitions/published-competition'),
      { DB: {} } as any,
    );

    expect(response.status).toBe(200);
    expect(handlePublicCompetitionRoutes).toHaveBeenCalledWith(
      expect.any(Request),
      expect.anything(),
      '/api/public/competitions/published-competition',
      'GET',
      { logger: console },
    );
    expect(verifyToken).not.toHaveBeenCalled();
    expect(handleCompetitionRoutes).not.toHaveBeenCalled();
  });

  it('terminates unknown public namespace shapes before JWT with generic 404', async () => {
    const verifyToken = vi.fn(() => new Response('unauthorized', { status: 401 }));
    const handlePublicCompetitionRoutes = vi.fn(async () => null);
    const fetch = createWorkerFetch({
      handleCors: () => null,
      corsHeaders: () => ({}),
      enforceOriginGuard: () => null,
      verifyToken,
      jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
      errorResponse: (message: string, status = 400) => Response.json({ status: 'error', message }, { status }),
      internalErrorResponse: () => Response.json({ status: 'error' }, { status: 500 }),
      rateLimit: async () => null,
      handlePhieuSubdomain: nullRoute,
      handlePublicPhieuApi: nullRoute,
      handlePublicCompetitionRoutes,
      handleCompetitionRoutes: nullRoute,
      handleParentPortalRoutes: async () => new Response('not found', { status: 404 }),
    } as any);

    const response = await fetch(
      new Request('https://api.thtohieu.com/api/public/competitions/slug/not-a-surface'),
      { DB: {} } as any,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: 'error', message: 'Not found' });
    expect(handlePublicCompetitionRoutes).toHaveBeenCalled();
    expect(verifyToken).not.toHaveBeenCalled();
  });
});
