import { safeJsonParse } from './normalization';
import type { GameProfileRow } from './types';

const addIf = (codes: string[], condition: boolean, code: string, unlocked: Set<string>) => {
    if (condition && !unlocked.has(code)) codes.push(code);
};

export const profileAchievementCodes = (
    profile: GameProfileRow, unlocked: Set<string>
): string[] => {
    const codes: string[] = [];
    const streak = Number(profile.daily_streak) || 0;
    addIf(codes, streak >= 3, 'streak_3', unlocked);
    addIf(codes, streak >= 7, 'streak_7', unlocked);
    addIf(codes, streak >= 30, 'streak_30', unlocked);
    addIf(codes, streak >= 100, 'streak_100', unlocked);
    const collectionSize = safeJsonParse<Array<{ id: string }>>(profile.collection_json, []).length;
    addIf(codes, collectionSize >= 5, 'collector_5', unlocked);
    addIf(codes, collectionSize >= 10, 'collector_10', unlocked);
    return codes;
};

export const dailyAchievementCodes = (stats: any, unlocked: Set<string>): string[] => {
    const codes: string[] = [];
    addIf(codes, Number(stats?.total_quizzes) >= 1, 'first_quiz', unlocked);
    addIf(codes, Number(stats?.completed_days) >= 1, 'daily_hat_trick', unlocked);
    addIf(codes, Number(stats?.completed_days) >= 7, 'weekly_warrior', unlocked);
    return codes;
};

export const needsResultStats = (unlocked: Set<string>): boolean => [
    'math_expert_50', 'math_expert_100', 'vietnamese_expert_50', 'english_expert_50',
    'speed_demon_10', 'speed_master_30', 'perfect_5', 'perfect_20',
    'early_bird_10', 'night_owl_10', 'questions_100', 'questions_500', 'questions_1000',
].some((code) => !unlocked.has(code));

export const resultAchievementCodes = (stats: any, unlocked: Set<string>): string[] => {
    const codes: string[] = [];
    const values = {
        math: Number(stats?.math_correct) || 0,
        vietnamese: Number(stats?.vietnamese_correct) || 0,
        english: Number(stats?.english_correct) || 0,
        speed: Number(stats?.speed_count) || 0,
        perfect: Number(stats?.perfect_count) || 0,
        early: Number(stats?.early_bird_count) || 0,
        night: Number(stats?.night_owl_count) || 0,
        correct: Number(stats?.total_correct) || 0,
    };
    addIf(codes, values.math >= 50, 'math_expert_50', unlocked);
    addIf(codes, values.math >= 100, 'math_expert_100', unlocked);
    addIf(codes, values.vietnamese >= 50, 'vietnamese_expert_50', unlocked);
    addIf(codes, values.english >= 50, 'english_expert_50', unlocked);
    addIf(codes, values.speed >= 10, 'speed_demon_10', unlocked);
    addIf(codes, values.speed >= 30, 'speed_master_30', unlocked);
    addIf(codes, values.perfect >= 5, 'perfect_5', unlocked);
    addIf(codes, values.perfect >= 20, 'perfect_20', unlocked);
    addIf(codes, values.early >= 10, 'early_bird_10', unlocked);
    addIf(codes, values.night >= 10, 'night_owl_10', unlocked);
    addIf(codes, values.correct >= 100, 'questions_100', unlocked);
    addIf(codes, values.correct >= 500, 'questions_500', unlocked);
    addIf(codes, values.correct >= 1000, 'questions_1000', unlocked);
    return codes;
};
