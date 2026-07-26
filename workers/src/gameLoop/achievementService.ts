import { ACHIEVEMENTS } from './constants';
import {
    getAchievementRows,
    getDailyAchievementAggregates,
    getResultAchievementStats,
    insertAchievementCodes,
} from './achievementRepository';
import {
    dailyAchievementCodes,
    needsResultStats,
    profileAchievementCodes,
    resultAchievementCodes,
} from './achievementRules';
import type { GameProfileRow } from './types';

export const unlockAchievementsIfNeeded = async (
    db: D1Database,
    profile: GameProfileRow,
    username: string
) => {
    const currentRows = await getAchievementRows(db, username);
    const unlocked = new Set(currentRows.results.map((row) => row.achievement_code));
    const dailyStats = await getDailyAchievementAggregates(db, username);
    const codes = [
        ...profileAchievementCodes(profile, unlocked),
        ...dailyAchievementCodes(dailyStats, unlocked),
    ];

    if (needsResultStats(unlocked)) {
        const resultStats = await getResultAchievementStats(db, username);
        codes.push(...resultAchievementCodes(resultStats, unlocked));
    }

    await insertAchievementCodes(db, username, codes);
    const refreshedRows = await getAchievementRows(db, username);
    const byCode = new Map(
        refreshedRows.results.map((row) => [row.achievement_code, row.unlocked_at])
    );
    return ACHIEVEMENTS
        .filter((achievement) => byCode.has(achievement.code))
        .map((achievement) => ({
            ...achievement,
            unlockedAt: byCode.get(achievement.code) || '',
        }));
};
