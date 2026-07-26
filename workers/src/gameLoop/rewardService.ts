import { generateId } from '../utils/response';
import { safeJsonParse } from './normalization';
import type { RewardType } from './types';

export const appendRewardEvent = async (
    db: D1Database,
    username: string,
    eventType: string,
    rewardType: RewardType,
    payload: Record<string, unknown>
) => {
    await db.prepare(`
        INSERT INTO student_reward_events
        (id, username, event_type, reward_type, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
        generateId('greward'),
        username,
        eventType,
        rewardType,
        JSON.stringify(payload),
        new Date().toISOString()
    ).run();
};

export const getRecentRewards = async (db: D1Database, username: string) => {
    const rows = await db.prepare(`
        SELECT event_type, reward_type, payload_json, created_at
        FROM student_reward_events
        WHERE username = ?
        ORDER BY created_at DESC
        LIMIT 4
    `).bind(username).all<any>();

    return rows.results.map((row: any) => ({
        eventType: row.event_type,
        rewardType: row.reward_type,
        payload: safeJsonParse<Record<string, unknown>>(row.payload_json, {}),
        createdAt: row.created_at,
    }));
};
