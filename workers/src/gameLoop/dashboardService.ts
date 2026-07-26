import { unlockAchievementsIfNeeded } from './achievementService';
import { getStudentCoins, getWeeklySummary } from './dashboardRepository';
import { getBangkokDateKey } from './dateKeys';
import { areAllMissionsClaimed, getMissionRows } from './missionModel';
import { safeJsonParse } from './normalization';
import { ensureProfile, getOrCreateDailyProgress } from './progressRepository';
import { getRecentRewards } from './rewardService';

export const buildDashboardResponse = async (db: D1Database, username: string) => {
    const todayDateKey = getBangkokDateKey();
    const profile = await ensureProfile(db, username);
    const progress = await getOrCreateDailyProgress(db, username, todayDateKey);
    const missions = getMissionRows(progress);
    const achievements = await unlockAchievementsIfNeeded(db, profile, username);
    const coins = await getStudentCoins(db, username);
    const weekly = await getWeeklySummary(db, username);
    const collection = safeJsonParse<Array<{ id: string; title: string; icon: string }>>(
        profile.collection_json, []
    );
    const recentRewards = await getRecentRewards(db, username);

    return {
        todayDateKey, wallet: { coins }, missions,
        bonusChest: {
            available: areAllMissionsClaimed(missions) && Number(progress.chest_claimed) !== 1,
            claimed: Number(progress.chest_claimed) === 1,
        },
        weekly,
        profile: {
            dailyStreak: Number(profile.daily_streak) || 0,
            hintTokens: Number(profile.hint_tokens) || 0,
            streakShields: Number(profile.streak_shields) || 0,
            collection,
        },
        achievements, recentRewards,
    };
};
