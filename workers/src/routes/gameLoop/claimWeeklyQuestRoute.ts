import { resolveStudentRewardIdentity } from '../../gamification/rewardIdentity';
import { applyStudentReward, parseRewardPayload } from '../../gamification/studentRewardLedger';
import { WEEKLY_QUESTS } from '../../gameLoop/constants';
import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { getCurrentWeekKey } from '../../gameLoop/dateKeys';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

type WeeklyRewardItem = { type: string; quantity: number; itemId?: string; title?: string };
interface WeeklyLedgerPayload extends Record<string, unknown> {
    questId?: string;
    coins?: number;
    items?: WeeklyRewardItem[];
}

const selectRandomPetAccessory = async (db: D1Database): Promise<WeeklyRewardItem | null> => {
    const rows = await db.prepare(`
        SELECT item_id, name
        FROM shop_items
        WHERE UPPER(COALESCE(type, '')) = 'ACCESSORY'
        ORDER BY item_id ASC
    `).all<any>();
    const accessories = rows.results || [];
    if (accessories.length === 0) return null;
    const index = Math.min(accessories.length - 1, Math.floor(Math.random() * accessories.length));
    const picked = accessories[index];
    return {
        type: 'pet_accessory',
        quantity: 1,
        itemId: String(picked.item_id),
        title: String(picked.name || 'Phụ kiện thú cưng'),
    };
};

export const handleClaimWeeklyQuestRoute = async (
    request: Request,
    db: D1Database,
    username: string
): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    const questId = String(body.questId || '').trim();
    if (!questId) return errorResponse('Missing questId');

    const weekKey = getCurrentWeekKey();
    const quest = WEEKLY_QUESTS.find((item) => item.id === questId);
    if (!quest) return errorResponse('Quest not found', 404);
    const progress = await db.prepare(`
        SELECT * FROM student_weekly_progress
        WHERE username = ? AND week_key = ? AND quest_id = ?
    `).bind(username, weekKey, questId).first<any>();
    if (!progress) return errorResponse('Quest progress not found', 404);
    if (Number(progress.progress) < quest.target) return errorResponse('Quest not completed yet');

    const identity = await resolveStudentRewardIdentity(db, username);
    if (!identity) return errorResponse('Student not found', 404);
    const sourceKey = `${weekKey}:${questId}`;

    if (Number(progress.claimed) === 1) {
        const receipt = await db.prepare(`
            SELECT id, student_id, source_type, source_key, reward_type,
                   coins_delta, exp_delta, payload_json, created_at
            FROM student_reward_ledger
            WHERE student_id = ? AND source_type = 'WEEKLY_QUEST' AND source_key = ?
            LIMIT 1
        `).bind(identity.studentId, sourceKey).first<any>();
        if (!receipt) return errorResponse('Weekly quest claim state is inconsistent', 409);
        const stored = parseRewardPayload<WeeklyLedgerPayload>(receipt, {});
        const data = await buildDashboardResponse(db, username);
        return jsonResponse({
            status: 'success',
            alreadyClaimed: true,
            reward: {
                type: 'COINS', coins: Number(stored.coins) || quest.reward.coins,
                questId, items: stored.items || quest.reward.items,
            },
            data,
        });
    }

    const issuedItems: WeeklyRewardItem[] = [];
    for (const item of quest.reward.items) {
        if (item.type === 'pet_accessory_random') {
            const accessory = await selectRandomPetAccessory(db);
            if (!accessory) return errorResponse('No pet accessory is available for this reward', 503);
            issuedItems.push(accessory);
        } else {
            issuedItems.push({ type: item.type, quantity: item.quantity });
        }
    }

    const now = new Date().toISOString();
    const extraStatements: D1PreparedStatement[] = [
        db.prepare(`
            UPDATE student_weekly_progress
            SET claimed = 1, updated_at = ?
            WHERE username = ? AND week_key = ? AND quest_id = ?
        `).bind(now, username, weekKey, questId),
    ];

    for (const item of issuedItems) {
        if (item.type === 'hint_token') extraStatements.push(db.prepare(`
            UPDATE student_game_profiles
            SET hint_tokens = hint_tokens + ?, updated_at = ? WHERE username = ?
        `).bind(item.quantity, now, username));
        else if (item.type === 'streak_shield') extraStatements.push(db.prepare(`
            UPDATE student_game_profiles
            SET streak_shields = streak_shields + ?, updated_at = ? WHERE username = ?
        `).bind(item.quantity, now, username));
        else if (item.type === 'pet_accessory' && item.itemId) {
            extraStatements.push(
                db.prepare(`
                    INSERT OR IGNORE INTO user_pets (
                      username, pet_id, pet_name, level, exp, exp_to_next, total_exp,
                      mood, items, last_active
                    ) VALUES (?, 'cat_01', 'Mèo Con', 1, 0, 100, 0, 'happy', '[]', ?)
                `).bind(username, now),
                db.prepare(`
                    UPDATE user_pets
                    SET items = json_insert(
                          CASE WHEN json_valid(items) THEN items ELSE '[]' END,
                          '$[#]', ?
                        ),
                        last_active = ?
                    WHERE username = ?
                `).bind(item.itemId, now, username),
            );
        }
    }

    extraStatements.push(db.prepare(`
        INSERT INTO student_reward_events
        (id, username, event_type, reward_type, payload_json, created_at)
        VALUES (?, ?, 'WEEKLY_QUEST_CLAIM', 'COINS', ?, ?)
    `).bind(
        `reward-event-${crypto.randomUUID()}`,
        username,
        JSON.stringify({ questId, coins: quest.reward.coins, items: issuedItems }),
        now,
    ));

    const rewardResult = await applyStudentReward(db, {
        ...identity,
        sourceType: 'WEEKLY_QUEST',
        sourceKey,
        rewardType: issuedItems.length > 0 ? 'COINS_ITEMS' : 'COINS',
        coinsDelta: quest.reward.coins,
        expDelta: 0,
        payload: { questId, coins: quest.reward.coins, items: issuedItems },
        extraStatements,
    });
    const stored = parseRewardPayload<WeeklyLedgerPayload>(rewardResult.ledger, {
        questId, coins: quest.reward.coins, items: issuedItems,
    });
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({
        status: 'success',
        alreadyClaimed: rewardResult.alreadyClaimed,
        reward: {
            type: 'COINS', coins: Number(stored.coins) || quest.reward.coins,
            questId, items: stored.items || issuedItems,
        },
        data,
    });
};
