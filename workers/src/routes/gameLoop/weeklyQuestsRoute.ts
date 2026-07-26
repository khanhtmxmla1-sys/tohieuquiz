import { WEEKLY_QUESTS } from '../../gameLoop/constants';
import { getCurrentWeekKey } from '../../gameLoop/dateKeys';
import { getOrCreateWeeklyProgress } from '../../gameLoop/weeklyQuestService';
import { jsonResponse } from '../../utils/response';

export const handleWeeklyQuestsRoute = async (
    db: D1Database,
    username: string
): Promise<Response> => {
    const weekKey = getCurrentWeekKey();
    const progressRows = await getOrCreateWeeklyProgress(db, username, weekKey);
    const quests = WEEKLY_QUESTS.map((quest) => {
        const progress = progressRows.find((row: any) => row.quest_id === quest.id);
        return {
            ...quest,
            progress: Number(progress?.progress) || 0,
            completed: (Number(progress?.progress) || 0) >= quest.target,
            claimed: Number(progress?.claimed || 0) === 1,
        };
    });
    return jsonResponse({ status: 'success', weekKey, quests });
};
