import { WEEKLY_QUESTS } from './constants';

const buildWeeklyProgressSeedStatements = (
    db: D1Database,
    username: string,
    weekKey: string,
    now: string,
): D1PreparedStatement[] => WEEKLY_QUESTS.map(quest =>
    db.prepare(`
        INSERT OR IGNORE INTO student_weekly_progress
        (username, week_key, quest_id, progress, target, claimed, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, 0, ?, ?)
    `).bind(username, weekKey, quest.id, quest.target, now, now)
);

export const getOrCreateWeeklyProgress = async (
    db: D1Database,
    username: string,
    weekKey: string
): Promise<any[]> => {
    const now = new Date().toISOString();
    await db.batch(buildWeeklyProgressSeedStatements(db, username, weekKey, now));

    const rows = await db.prepare(`
        SELECT * FROM student_weekly_progress
        WHERE username = ? AND week_key = ?
    `).bind(username, weekKey).all();

    return rows.results || [];
};

export const updateWeeklyQuestProgress = async (
    db: D1Database,
    username: string,
    weekKey: string,
    updates: Record<string, number>
): Promise<void> => {
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = buildWeeklyProgressSeedStatements(db, username, weekKey, now);

    for (const [questId, increment] of Object.entries(updates)) {
        statements.push(
            db.prepare(`
                UPDATE student_weekly_progress
                SET progress = progress + ?, updated_at = ?
                WHERE username = ? AND week_key = ? AND quest_id = ?
            `).bind(Math.trunc(Number(increment) || 0), now, username, weekKey, questId)
        );
    }

    await db.batch(statements);
};
