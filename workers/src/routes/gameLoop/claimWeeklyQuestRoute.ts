import { WEEKLY_QUESTS } from '../../gameLoop/constants';
import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { getCurrentWeekKey } from '../../gameLoop/dateKeys';
import { appendRewardEvent } from '../../gameLoop/rewardService';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

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
    if (Number(progress.claimed) === 1) return errorResponse('Quest already claimed');
    if (Number(progress.progress) < quest.target) return errorResponse('Quest not completed yet');

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [
        db.prepare(`
            UPDATE student_weekly_progress
            SET claimed = 1, updated_at = ?
            WHERE username = ? AND week_key = ? AND quest_id = ?
        `).bind(now, username, weekKey, questId),
        db.prepare('UPDATE students SET coins = coins + ? WHERE username = ?')
            .bind(quest.reward.coins, username),
    ];
    const items = quest.reward.items as readonly string[];
    if (items.some((item) => item === 'hint_token')) statements.push(db.prepare(`
        UPDATE student_game_profiles
        SET hint_tokens = hint_tokens + ?, updated_at = ? WHERE username = ?
    `).bind(quest.reward.itemCount, now, username));
    if (items.some((item) => item === 'streak_shield')) statements.push(db.prepare(`
        UPDATE student_game_profiles
        SET streak_shields = streak_shields + ?, updated_at = ? WHERE username = ?
    `).bind(quest.reward.itemCount, now, username));

    await db.batch(statements);
    await appendRewardEvent(db, username, 'WEEKLY_QUEST_CLAIM', 'COINS', {
        questId, coins: quest.reward.coins, items: quest.reward.items,
    });
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({
        status: 'success', data,
        reward: {
            type: 'COINS', coins: quest.reward.coins,
            questId, items: quest.reward.items,
        },
    });
};
