import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import type { ResultRouteContext } from '../workers/src/routes/results/context';

const routeMocks = vi.hoisted(() => ({
    verifyJWTMiddleware: vi.fn(),
    handleInterventionRoutes: vi.fn(),
    read: vi.fn(),
    analysis: vi.fn(),
    submit: vi.fn(),
    delete: vi.fn(),
    validate: vi.fn(),
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware: routeMocks.verifyJWTMiddleware,
}));

vi.mock('../workers/src/routes/interventions', () => ({
    handleInterventionRoutes: routeMocks.handleInterventionRoutes,
}));

vi.mock('../workers/src/routes/results/readRoutes', () => ({
    handleResultReadRoutes: routeMocks.read,
}));

vi.mock('../workers/src/routes/results/analysisRoutes', () => ({
    handleResultAnalysisRoutes: routeMocks.analysis,
}));

vi.mock('../workers/src/routes/results/submitRoute', () => ({
    handleResultSubmitRoute: routeMocks.submit,
}));

vi.mock('../workers/src/routes/results/deleteRoute', () => ({
    handleResultDeleteRoute: routeMocks.delete,
}));

vi.mock('../workers/src/routes/results/validateRoute', () => ({
    handleResultValidateRoute: routeMocks.validate,
}));

import { handleResultRoutes } from '../workers/src/routes/results';

const user = {
    role: 'teacher',
    username: 'teacher@example.com',
} as JWTPayload;

const context = (path: string, method = 'GET'): ResultRouteContext => ({
    request: new Request(`https://test${path}`),
    env: { DB: {} } as any,
    db: {} as any,
    user,
    path,
    method,
});

const request = (path: string): Request => new Request(`https://test${path}`);
const env = { DB: {} } as any;
const handlers = [routeMocks.read, routeMocks.analysis, routeMocks.submit, routeMocks.delete, routeMocks.validate];

const setAuthenticated = () => {
    routeMocks.verifyJWTMiddleware.mockResolvedValue({ user });
    routeMocks.handleInterventionRoutes.mockResolvedValue(null);
    handlers.forEach((handler) => handler.mockResolvedValue(null));
};

describe('result route dispatch seams', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setAuthenticated();
    });

    it('keeps the extracted read handler seam isolated for paths it does not own', async () => {
        const actual = await vi.importActual<typeof import('../workers/src/routes/results/readRoutes')>(
            '../workers/src/routes/results/readRoutes',
        );
        await expect(actual.handleResultReadRoutes(context('/api/results/not-owned'))).resolves.toBeNull();
    });

    it('short-circuits intervention and result handlers when authentication fails', async () => {
        const authFailure = new Response(JSON.stringify({ status: 'error' }), { status: 401 });
        routeMocks.verifyJWTMiddleware.mockResolvedValue(authFailure);

        const response = await handleResultRoutes(request('/api/results/not-owned'), env, '/api/results/not-owned', 'GET');

        expect(response).toBe(authFailure);
        expect(routeMocks.handleInterventionRoutes).not.toHaveBeenCalled();
        handlers.forEach((handler) => expect(handler).not.toHaveBeenCalled());
    });

    it('lets an intervention response short-circuit every result route module', async () => {
        const intervention = new Response('intervention', { status: 202 });
        routeMocks.handleInterventionRoutes.mockResolvedValue(intervention);

        const response = await handleResultRoutes(request('/api/results/intervention'), env, '/api/results/intervention', 'GET');

        expect(response).toBe(intervention);
        handlers.forEach((handler) => expect(handler).not.toHaveBeenCalled());
    });

    it('dispatches read, analysis, submit, delete, validate in order and stops on a response', async () => {
        const order: string[] = [];
        routeMocks.read.mockImplementation(async () => {
            order.push('read');
            return null;
        });
        routeMocks.analysis.mockImplementation(async () => {
            order.push('analysis');
            return null;
        });
        const submission = new Response('submitted', { status: 201 });
        routeMocks.submit.mockImplementation(async () => {
            order.push('submit');
            return submission;
        });

        const response = await handleResultRoutes(request('/api/results'), env, '/api/results', 'POST');

        expect(response).toBe(submission);
        expect(order).toEqual(['read', 'analysis', 'submit']);
        expect(routeMocks.delete).not.toHaveBeenCalled();
        expect(routeMocks.validate).not.toHaveBeenCalled();
    });

    it('preserves the complete handler order when no module owns the path', async () => {
        const order: string[] = [];
        handlers.forEach((handler, index) => handler.mockImplementation(async () => {
            order.push(['read', 'analysis', 'submit', 'delete', 'validate'][index]);
            return null;
        }));

        const response = await handleResultRoutes(request('/api/results/not-owned'), env, '/api/results/not-owned', 'GET');

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            status: 'error',
            message: 'Not found: /api/results/not-owned',
        });
        expect(order).toEqual(['read', 'analysis', 'submit', 'delete', 'validate']);
    });
});
