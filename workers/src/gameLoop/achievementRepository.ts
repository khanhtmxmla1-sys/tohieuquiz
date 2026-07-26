import { generateId } from '../utils/response';
import type { AchievementRow } from './types';

export const getAchievementRows = (db: D1Database, username: string) =>
    db.prepare(`
        SELECT achievement_code, unlocked_at
        FROM student_achievement_unlocks
        WHERE username = ?
        ORDER BY unlocked_at DESC
    `).bind(username).all<AchievementRow>();

export const getDailyAchievementAggregates = (db: D1Database, username: string) =>
    db.prepare(`
        SELECT
            COALESCE(SUM(quizzes_completed), 0) AS total_quizzes,
            COALESCE(SUM(
                CASE
                    WHEN mission_questions_claimed = 1
                     AND mission_accuracy_claimed = 1
                     AND mission_subject_claimed = 1
                    THEN 1 ELSE 0
                END
            ), 0) AS completed_days
        FROM student_daily_progress
        WHERE username = ?
    `).bind(username).first<any>();

export const getResultAchievementStats = (db: D1Database, username: string) =>
    db.prepare(`
        SELECT
            COALESCE(SUM(CASE WHEN (q.category = 'Toán' OR q.category = 'toan') AND r.score >= 80 THEN r.correct_count ELSE 0 END), 0) AS math_correct,
            COALESCE(SUM(CASE WHEN (q.category LIKE '%Việt%' OR q.category LIKE '%viet%') AND r.score >= 80 THEN r.correct_count ELSE 0 END), 0) AS vietnamese_correct,
            COALESCE(SUM(CASE WHEN (q.category LIKE '%Anh%' OR q.category LIKE '%English%') AND r.score >= 80 THEN r.correct_count ELSE 0 END), 0) AS english_correct,
            COALESCE(SUM(CASE WHEN r.time_taken > 0 AND q.time_limit > 0 AND r.time_taken < (q.time_limit * 0.5) THEN 1 ELSE 0 END), 0) AS speed_count,
            COALESCE(SUM(CASE WHEN r.total_questions > 0 AND r.correct_count = r.total_questions THEN 1 ELSE 0 END), 0) AS perfect_count,
            COALESCE(SUM(CASE WHEN CAST(strftime('%H', r.submitted_at) AS INTEGER) < 7 THEN 1 ELSE 0 END), 0) AS early_bird_count,
            COALESCE(SUM(CASE WHEN CAST(strftime('%H', r.submitted_at) AS INTEGER) >= 21 THEN 1 ELSE 0 END), 0) AS night_owl_count,
            COALESCE(SUM(r.correct_count), 0) AS total_correct
        FROM results r
        LEFT JOIN quizzes q ON r.quiz_id = q.id
        WHERE r.student_name = ?
    `).bind(username).first<any>();

export const insertAchievementCodes = async (
    db: D1Database, username: string, codes: string[]
): Promise<void> => {
    if (codes.length === 0) return;
    const now = new Date().toISOString();
    await db.batch(codes.map((code) => db.prepare(`
        INSERT INTO student_achievement_unlocks
        (id, username, achievement_code, unlocked_at, metadata)
        VALUES (?, ?, ?, ?, '{}')
    `).bind(generateId('gach'), username, code, now)));
};
