import { resolveStudentRewardIdentity } from '../../gamification/rewardIdentity';
import { applyStudentReward } from '../../gamification/studentRewardLedger';
import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { getCurrentDateKey } from '../../gameLoop/dateKeys';
import {
    areAllMissionsClaimed,
    getMissionClaimColumn,
    getMissionRows,
} from '../../gameLoop/missionModel';
import { ensureProfile, getOrCreateDailyProgress } from '../../gameLoop/progressRepository';
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

    const dateKey = getCurrentDateKey();
    const profile = await ensureProfile(db, username);
    const progress = await getOrCreateDailyProgress(db, username, dateKey);
    const missions = getMissionRows(progress);
    const mission = missions.find((item) => item.id === missionId);
    if (!mission) return errorResponse('Mission not found', 404);
    if (!mission.completed) return errorResponse('Mission is not complete yet');

    const identity = await resolveStudentRewardIdentity(db, username);
    if (!identity) return errorResponse('Student not found', 404);
    const sourceKey = `${dateKey}:${missionId}`;

    if (mission.claimed) {
        const receipt = await db.prepare(`
            SELECT id FROM student_reward_ledger
            WHERE student_id = ? AND source_type = 'DAILY_MISSION' AND source_key = ?
            LIMIT 1
        `).bind(identity.studentId, sourceKey).first<any>();
        if (!receipt) return errorResponse('Mission claim state is inconsistent', 409);
    }

    const now = new Date().toISOString();
    const claimColumn = getMissionClaimColumn(missionId);
    const rewardResult = await applyStudentReward(db, {
        ...identity,
        sourceType: 'DAILY_MISSION',
        sourceKey,
        rewardType: 'COINS',
        coinsDelta: mission.rewardCoins,
        expDelta: 0,
        payload: { missionId, coins: mission.rewardCoins },
        extraStatements: [
            db.prepare(`
                UPDATE student_daily_progress
                SET ${claimColumn} = 1, updated_at = ?
                WHERE username = ? AND progress_date = ?
            `).bind(now, username, dateKey),
            db.prepare(`
                INSERT INTO student_reward_events
                (id, username, event_type, reward_type, payload_json, created_at)
                VALUES (?, ?, 'MISSION_CLAIM', 'COINS', ?, ?)
            `).bind(
                `reward-event-${crypto.randomUUID()}`,
                username,
                JSON.stringify({ missionId, coins: mission.rewardCoins }),
                now,
            ),
        ],
    });

    const refreshed = getMissionRows(await getOrCreateDailyProgress(db, username, dateKey));
    if (!rewardResult.alreadyClaimed
        && !areAllMissionsClaimed(missions)
        && areAllMissionsClaimed(refreshed)) {
        await syncDailyStreakIfNeeded(db, profile, dateKey);
    }
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({
        status: 'success',
        alreadyClaimed: rewardResult.alreadyClaimed,
        reward: { type: 'COINS', coins: mission.rewardCoins, missionId },
        data,
    });
};
