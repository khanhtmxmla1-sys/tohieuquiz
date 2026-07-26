import { getPreviousDateKey } from './dateKeys';
import type { GameProfileRow } from './types';

export const syncDailyStreakIfNeeded = async (
    db: D1Database,
    profile: GameProfileRow,
    dateKey: string
): Promise<GameProfileRow> => {
    if (profile.last_mission_completion_date === dateKey) {
        return profile;
    }

    const previousDateKey = getPreviousDateKey(dateKey);
    const nextStreak = profile.last_mission_completion_date === previousDateKey
        ? Number(profile.daily_streak || 0) + 1
        : 1;
    const now = new Date().toISOString();

    await db.prepare(`
        UPDATE student_game_profiles
        SET daily_streak = ?, last_mission_completion_date = ?, updated_at = ?
        WHERE username = ?
    `).bind(nextStreak, dateKey, now, profile.username).run();

    return {
        ...profile,
        daily_streak: nextStreak,
        last_mission_completion_date: dateKey,
        updated_at: now,
    };
};
