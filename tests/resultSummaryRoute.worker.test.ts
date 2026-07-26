import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import type { ResultDashboardSummary } from '../shared/result-summary.contract';

let currentUser: JWTPayload;
const loadResultDashboardSummaryMock = vi.hoisted(() => vi.fn());

vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
    requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
    requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
    isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

vi.mock('../workers/src/services/resultSummaryService', () => ({
    loadResultDashboardSummary: loadResultDashboardSummaryMock,
}));

import { handleResultRoutes } from '../workers/src/routes/results';

const summary: ResultDashboardSummary = {
    totalSubmissions: 285,
    uniqueCompletedWorks: 188,
    todaySubmissions: 0,
    uniqueStudents: 18,
    attemptPolicy: 'latest',
    timezone: 'Asia/Ho_Chi_Minh',
    statistics: {
        totalResults: 188,
        mean: 5.76,
        median: 6,
        stdDev: 2.1,
        min: 0,
        max: 10,
        passRate: 67,
        passCount: 125,
        failCount: 63,
        scoreDistribution: [
            { range: '0-2', count: 20, percentage: 10.64 },
            { range: '3-4', count: 43, percentage: 22.87 },
            { range: '5-6', count: 50, percentage: 26.6 },
            { range: '7-8', count: 45, percentage: 23.94 },
            { range: '9-10', count: 30, percentage: 15.96 },
        ],
    },
};

const request = new Request('https://example.test/api/results/summary');
const db = { prepare: vi.fn(() => { throw new Error('route test must use summary service'); }) };

describe('GET /api/results/summary', () => {
    beforeEach(() => {
        loadResultDashboardSummaryMock.mockReset().mockResolvedValue(summary);
    });

    it('returns a whole-school summary for an admin', async () => {
        currentUser = {
            username: 'admin',
            role: 'admin',
            fullName: 'Quản trị viên',
        } as JWTPayload;

        const response = await handleResultRoutes(
            request,
            { DB: db } as any,
            '/api/results/summary',
            'GET',
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: summary });
        expect(loadResultDashboardSummaryMock).toHaveBeenCalledWith(db, { role: 'admin' });
    });

    it('scopes a teacher summary by the authenticated username', async () => {
        currentUser = {
            username: 'teacher-a',
            role: 'teacher',
            fullName: 'Cô A',
        } as JWTPayload;

        const response = await handleResultRoutes(
            request,
            { DB: db } as any,
            '/api/results/summary',
            'GET',
        );

        expect(response.status).toBe(200);
        expect(loadResultDashboardSummaryMock).toHaveBeenCalledWith(db, {
            role: 'teacher',
            username: 'teacher-a',
        });
    });

    it('rejects a student before loading summary data', async () => {
        currentUser = {
            username: 'student-a',
            role: 'student',
            fullName: 'Học sinh A',
        } as JWTPayload;

        const response = await handleResultRoutes(
            request,
            { DB: db } as any,
            '/api/results/summary',
            'GET',
        );

        expect(response.status).toBe(403);
        expect(loadResultDashboardSummaryMock).not.toHaveBeenCalled();
    });
});
