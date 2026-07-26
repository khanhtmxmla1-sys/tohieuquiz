import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import { GameLoopDatabase, gameLoopEnv, gameLoopRequest } from './fixtures/gameLoopWorkerFixture';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
    verifyJWTMiddleware: vi.fn(async () => currentUser
        ? { user: currentUser }
        : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
    isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleGameLoopRoutes } from '../workers/src/routes/gameLoop';

const asStudent = () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
};
const callRoute = (path: string, method: string, db = new GameLoopDatabase(), body?: string) =>
    handleGameLoopRoutes(
        gameLoopRequest(path, { method, ...(body === undefined ? {} : { body }) }),
        gameLoopEnv(db), path, method,
    );

describe('Game Loop route contracts', () => {
    beforeEach(() => { currentUser = null; });

    it('bootstraps tables before returning the JWT failure', async () => {
        const db = new GameLoopDatabase();
        const response = await callRoute('/api/game-loop/dashboard', 'GET', db);
        expect(response.status).toBe(401);
        expect(db.executed.some(({ sql }) =>
            sql.includes('CREATE TABLE IF NOT EXISTS student_game_profiles'))).toBe(true);
    });

    it('allows students only', async () => {
        currentUser = { username: 'teacher-a', role: 'teacher' };
        const response = await callRoute('/api/game-loop/dashboard', 'GET');
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            message: 'Forbidden: Game-loop routes are for students only',
        });
    });

    it('keeps the dashboard response envelope and top-level keys', async () => {
        asStudent();
        const response = await callRoute('/api/game-loop/dashboard', 'GET');
        const payload = await response.json() as any;
        expect(response.status).toBe(200);
        expect(payload.status).toBe('success');
        expect(Object.keys(payload.data).sort()).toEqual([
            'achievements', 'bonusChest', 'missions', 'profile',
            'recentRewards', 'todayDateKey', 'wallet', 'weekly',
        ]);
        expect(payload.data.wallet).toEqual({ coins: 120 });
    });

    it.each([
        ['/api/game-loop/track-quiz', 'Missing activityId'],
        ['/api/game-loop/claim-mission', 'Missing missionId'],
        ['/api/game-loop/claim-weekly-quest', 'Missing questId'],
    ])('keeps validation for %s', async (path, message) => {
        asStudent();
        const response = await callRoute(path, 'POST', new GameLoopDatabase(), '{}');
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ message });
    });

    it('keeps invalid JSON validation for chest claims', async () => {
        asStudent();
        const response = await callRoute('/api/game-loop/claim-chest', 'POST', new GameLoopDatabase(), '{');
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ message: 'Invalid JSON body' });
    });

    it('keeps the weekly quest response envelope', async () => {
        asStudent();
        const response = await callRoute('/api/game-loop/weekly-quests', 'GET');
        const payload = await response.json() as any;
        expect(response.status).toBe(200);
        expect(payload.status).toBe('success');
        expect(payload.weekKey).toMatch(/^\d{4}-W\d{2}$/);
        expect(payload.quests).toHaveLength(5);
        expect(payload.quests[0]).toMatchObject({
            id: 'weekly_20_quizzes', progress: 2, completed: false, claimed: false,
        });
    });

    it('keeps unsupported paths and methods on the 404 fallback', async () => {
        asStudent();
        const wrongMethod = await callRoute('/api/game-loop/dashboard', 'POST');
        expect(wrongMethod.status).toBe(404);
        await expect(wrongMethod.json()).resolves.toMatchObject({
            message: 'Not found: /api/game-loop/dashboard',
        });
        const unknownPath = await callRoute('/api/game-loop/unknown', 'GET');
        expect(unknownPath.status).toBe(404);
    });
});
