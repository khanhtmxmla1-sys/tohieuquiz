import { ensureGameLoopTables } from '../../gameLoop/tableBootstrap';
import { isStudent, verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { errorResponse } from '../../utils/response';
import { handleClaimChestRoute } from './claimChestRoute';
import { handleClaimMissionRoute } from './claimMissionRoute';
import { handleClaimWeeklyQuestRoute } from './claimWeeklyQuestRoute';
import { handleDashboardRoute } from './dashboardRoute';
import { handleTrackQuizRoute } from './trackQuizRoute';
import { handleWeeklyQuestsRoute } from './weeklyQuestsRoute';

export async function handleGameLoopRoutes(
    request: Request,
    env: Env,
    path: string,
    method: string
): Promise<Response> {
    const db = env.DB;
    await ensureGameLoopTables(db);
    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    if (!isStudent(authResult.user)) {
        return errorResponse('Forbidden: Game-loop routes are for students only', 403);
    }
    const username = authResult.user.username;

    if (path === '/api/game-loop/dashboard' && method === 'GET') {
        return handleDashboardRoute(db, username);
    }
    if (path === '/api/game-loop/track-quiz' && method === 'POST') {
        return handleTrackQuizRoute(request, db, username);
    }
    if (path === '/api/game-loop/claim-mission' && method === 'POST') {
        return handleClaimMissionRoute(request, db, username);
    }
    if (path === '/api/game-loop/claim-chest' && method === 'POST') {
        return handleClaimChestRoute(request, db, username);
    }
    if (path === '/api/game-loop/weekly-quests' && method === 'GET') {
        return handleWeeklyQuestsRoute(db, username);
    }
    if (path === '/api/game-loop/claim-weekly-quest' && method === 'POST') {
        return handleClaimWeeklyQuestRoute(request, db, username);
    }
    return errorResponse('Not found: ' + path, 404);
}
