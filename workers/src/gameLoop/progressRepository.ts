import type { DailyProgressRow, GameProfileRow } from './types';

export const ensureProfile = async (db: D1Database, username: string): Promise<GameProfileRow> => {
    let profile = await db.prepare(`
        SELECT *
        FROM student_game_profiles
        WHERE username = ?
        LIMIT 1
    `).bind(username).first<GameProfileRow>();

    if (profile) return profile;

    const now = new Date().toISOString();
    await db.prepare(`
        INSERT INTO student_game_profiles
        (username, daily_streak, last_mission_completion_date, hint_tokens, streak_shields, collection_json, created_at, updated_at)
        VALUES (?, 0, '', 0, 0, '[]', ?, ?)
    `).bind(username, now, now).run();

    profile = await db.prepare(`
        SELECT *
        FROM student_game_profiles
        WHERE username = ?
        LIMIT 1
    `).bind(username).first<GameProfileRow>();

    return profile as GameProfileRow;
};

export const getOrCreateDailyProgress = async (
    db: D1Database,
    username: string,
    dateKey: string
): Promise<DailyProgressRow> => {
    let progress = await db.prepare(`
        SELECT *
        FROM student_daily_progress
        WHERE username = ? AND progress_date = ?
        LIMIT 1
    `).bind(username, dateKey).first<DailyProgressRow>();

    if (progress) return progress;

    const now = new Date().toISOString();
    await db.prepare(`
        INSERT INTO student_daily_progress
        (username, progress_date, created_at, updated_at)
        VALUES (?, ?, ?, ?)
    `).bind(username, dateKey, now, now).run();

    progress = await db.prepare(`
        SELECT *
        FROM student_daily_progress
        WHERE username = ? AND progress_date = ?
        LIMIT 1
    `).bind(username, dateKey).first<DailyProgressRow>();

    return progress as DailyProgressRow;
};
