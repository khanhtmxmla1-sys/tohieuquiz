import { chooseChestReward } from '../../gameLoop/chestReward';
import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { getBangkokDateKey } from '../../gameLoop/dateKeys';
import { areAllMissionsClaimed, getMissionRows } from '../../gameLoop/missionModel';
import { safeJsonParse } from '../../gameLoop/normalization';
import { ensureProfile, getOrCreateDailyProgress } from '../../gameLoop/progressRepository';
import { appendRewardEvent } from '../../gameLoop/rewardService';
import type { CollectibleReward } from '../../gameLoop/types';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

export const handleClaimChestRoute = async (
    request: Request,
    db: D1Database,
    username: string
): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const dateKey = getBangkokDateKey();
    const profile = await ensureProfile(db, username);
    const progress = await getOrCreateDailyProgress(db, username, dateKey);
    if (!areAllMissionsClaimed(getMissionRows(progress))) {
        return errorResponse('Complete all missions before opening the chest');
    }
    if (Number(progress.chest_claimed) === 1) {
        return errorResponse('Bonus chest has already been claimed today');
    }

    const collection = safeJsonParse<CollectibleReward[]>(profile.collection_json, []);
    const reward = chooseChestReward(collection);
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [db.prepare(`
        UPDATE student_daily_progress
        SET chest_claimed = 1, updated_at = ?
        WHERE username = ? AND progress_date = ?
    `).bind(now, username, dateKey)];

    if (reward.type === 'COINS') statements.push(db.prepare(`
        UPDATE students SET coins = coins + ? WHERE username = ?
    `).bind(Number(reward.payload.coins) || 0, username));
    else if (reward.type === 'HINT_TOKEN') statements.push(db.prepare(`
        UPDATE student_game_profiles
        SET hint_tokens = hint_tokens + ?, updated_at = ? WHERE username = ?
    `).bind(Number(reward.payload.amount) || 0, now, username));
    else if (reward.type === 'STREAK_SHIELD') statements.push(db.prepare(`
        UPDATE student_game_profiles
        SET streak_shields = streak_shields + ?, updated_at = ? WHERE username = ?
    `).bind(Number(reward.payload.amount) || 0, now, username));
    else if (reward.type === 'COLLECTIBLE') {
        const nextCollection = [...collection, reward.payload as unknown as CollectibleReward];
        statements.push(db.prepare(`
            UPDATE student_game_profiles
            SET collection_json = ?, updated_at = ? WHERE username = ?
        `).bind(JSON.stringify(nextCollection), now, username));
    }

    await db.batch(statements);
    await appendRewardEvent(db, username, 'BONUS_CHEST', reward.type, reward.payload);
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({ status: 'success', data, reward });
};
