import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { getBangkokDateKey } from '../../gameLoop/dateKeys';
import {
    areAllMissionsClaimed,
    getMissionClaimColumn,
    getMissionRows,
} from '../../gameLoop/missionModel';
import { ensureProfile, getOrCreateDailyProgress } from '../../gameLoop/progressRepository';
import { appendRewardEvent } from '../../gameLoop/rewardService';
import { syncDailyStreakIfNeeded } from '../../gameLoop/streakService';
import type { MissionId } from '../../gameLoop/types';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

export const handleClaimMissionRoute = async (
    request: Request,
    db: D1Database,
    username: string
): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    const missionId = String(body.missionId || '').trim() as MissionId;
    if (!missionId) return errorResponse('Missing missionId');

    const dateKey = getBangkokDateKey();
    const profile = await ensureProfile(db, username);
    const progress = await getOrCreateDailyProgress(db, username, dateKey);
    const missions = getMissionRows(progress);
    const mission = missions.find((item) => item.id === missionId);
    if (!mission) return errorResponse('Mission not found', 404);
    if (!mission.completed) return errorResponse('Mission is not complete yet');
    if (mission.claimed) return errorResponse('Mission has already been claimed');

    const now = new Date().toISOString();
    await db.batch([
        db.prepare(`
            UPDATE student_daily_progress
            SET ${getMissionClaimColumn(missionId)} = 1, updated_at = ?
            WHERE username = ? AND progress_date = ?
        `).bind(now, username, dateKey),
        db.prepare(`UPDATE students SET coins = coins + ? WHERE username = ?`)
            .bind(mission.rewardCoins, username),
    ]);
    await appendRewardEvent(db, username, 'MISSION_CLAIM', 'COINS', {
        missionId, coins: mission.rewardCoins,
    });

    const refreshed = getMissionRows(await getOrCreateDailyProgress(db, username, dateKey));
    if (!areAllMissionsClaimed(missions) && areAllMissionsClaimed(refreshed)) {
        await syncDailyStreakIfNeeded(db, profile, dateKey);
    }
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({
        status: 'success', data,
        reward: { type: 'COINS', coins: mission.rewardCoins, missionId },
    });
};
