import { WEEKLY_QUESTS } from './constants';

export const getOrCreateWeeklyProgress = async (
    db: D1Database,
    username: string,
    weekKey: string
): Promise<any[]> => {
    const existing = await db.prepare(`
        SELECT * FROM student_weekly_progress
        WHERE username = ? AND week_key = ?
    `).bind(username, weekKey).all();

    if (existing.results && existing.results.length > 0) {
        return existing.results;
    }

    const now = new Date().toISOString();
    const statements = WEEKLY_QUESTS.map(quest =>
        db.prepare(`
            INSERT INTO student_weekly_progress
            (username, week_key, quest_id, progress, target, claimed, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, 0, ?, ?)
        `).bind(username, weekKey, quest.id, quest.target, now, now)
    );

    await db.batch(statements);

    const created = await db.prepare(`
        SELECT * FROM student_weekly_progress
        WHERE username = ? AND week_key = ?
    `).bind(username, weekKey).all();

    return created.results || [];
};

export const updateWeeklyQuestProgress = async (
    db: D1Database,
    username: string,
    weekKey: string,
    updates: Record<string, number>
): Promise<void> => {
    const now = new Date().toISOString();
    const statements = [];

    for (const [questId, increment] of Object.entries(updates)) {
        statements.push(
            db.prepare(`
                UPDATE student_weekly_progress
                SET progress = progress + ?, updated_at = ?
                WHERE username = ? AND week_key = ? AND quest_id = ?
            `).bind(increment, now, username, weekKey, questId)
        );
    }

    if (statements.length > 0) {
        await db.batch(statements);
    }
};
