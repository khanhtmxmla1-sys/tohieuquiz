import { resolveStudentRewardIdentity } from '../../gamification/rewardIdentity';
import { applyStudentReward, parseRewardPayload } from '../../gamification/studentRewardLedger';
import { chooseChestReward, type ChestReward } from '../../gameLoop/chestReward';
import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { getCurrentDateKey } from '../../gameLoop/dateKeys';
import { areAllMissionsClaimed, getMissionRows } from '../../gameLoop/missionModel';
import { safeJsonParse } from '../../gameLoop/normalization';
import { ensureProfile, getOrCreateDailyProgress } from '../../gameLoop/progressRepository';
import type { CollectibleReward } from '../../gameLoop/types';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

interface ChestLedgerPayload extends Record<string, unknown> {
    reward?: ChestReward;
}

export const handleClaimChestRoute = async (
    request: Request,
    db: D1Database,
    username: string
): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const dateKey = getCurrentDateKey();
    const identity = await resolveStudentRewardIdentity(db, username);
    if (!identity) return errorResponse('Student not found', 404);
    const profile = await ensureProfile(db, username);
    const progress = await getOrCreateDailyProgress(db, username, dateKey);
    if (!areAllMissionsClaimed(getMissionRows(progress))) {
        return errorResponse('Complete all missions before opening the chest');
    }

    if (Number(progress.chest_claimed) === 1) {
        const receipt = await db.prepare(`
            SELECT id, student_id, source_type, source_key, reward_type,
                   coins_delta, exp_delta, payload_json, created_at
            FROM student_reward_ledger
            WHERE student_id = ? AND source_type = 'DAILY_CHEST' AND source_key = ?
            LIMIT 1
        `).bind(identity.studentId, dateKey).first<any>();
        if (!receipt) return errorResponse('Bonus chest claim state is inconsistent', 409);
        const stored = parseRewardPayload<ChestLedgerPayload>(receipt, {});
        const data = await buildDashboardResponse(db, username);
        return jsonResponse({
            status: 'success',
            alreadyClaimed: true,
            data,
            reward: stored.reward || { type: 'LEGACY', payload: {} },
        });
    }

    const collection = safeJsonParse<CollectibleReward[]>(profile.collection_json, []);
    const proposedReward = chooseChestReward(collection);
    const now = new Date().toISOString();
    const extraStatements: D1PreparedStatement[] = [
        db.prepare(`
            UPDATE student_daily_progress
            SET chest_claimed = 1, updated_at = ?
            WHERE username = ? AND progress_date = ?
        `).bind(now, username, dateKey),
    ];

    if (proposedReward.type === 'HINT_TOKEN') extraStatements.push(db.prepare(`
        UPDATE student_game_profiles
        SET hint_tokens = hint_tokens + ?, updated_at = ? WHERE username = ?
    `).bind(Number(proposedReward.payload.amount) || 0, now, username));
    else if (proposedReward.type === 'STREAK_SHIELD') extraStatements.push(db.prepare(`
        UPDATE student_game_profiles
        SET streak_shields = streak_shields + ?, updated_at = ? WHERE username = ?
    `).bind(Number(proposedReward.payload.amount) || 0, now, username));
    else if (proposedReward.type === 'COLLECTIBLE') extraStatements.push(db.prepare(`
        UPDATE student_game_profiles
        SET collection_json = json_insert(
              CASE WHEN json_valid(collection_json) THEN collection_json ELSE '[]' END,
              '$[#]', json(?)
            ),
            updated_at = ?
        WHERE username = ?
    `).bind(JSON.stringify(proposedReward.payload), now, username));

    extraStatements.push(db.prepare(`
        INSERT INTO student_reward_events
        (id, username, event_type, reward_type, payload_json, created_at)
        VALUES (?, ?, 'BONUS_CHEST', ?, ?, ?)
    `).bind(
        `reward-event-${crypto.randomUUID()}`,
        username,
        proposedReward.type,
        JSON.stringify(proposedReward.payload),
        now,
    ));

    const rewardResult = await applyStudentReward(db, {
        ...identity,
        sourceType: 'DAILY_CHEST',
        sourceKey: dateKey,
        rewardType: proposedReward.type,
        coinsDelta: proposedReward.type === 'COINS' ? Number(proposedReward.payload.coins) || 0 : 0,
        expDelta: 0,
        payload: { reward: proposedReward },
        extraStatements,
    });

    const stored = parseRewardPayload<ChestLedgerPayload>(rewardResult.ledger, { reward: proposedReward });
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({
        status: 'success',
        alreadyClaimed: rewardResult.alreadyClaimed,
        data,
        reward: stored.reward || proposedReward,
    });
};
