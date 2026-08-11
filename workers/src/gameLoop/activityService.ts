import { WEEKLY_QUESTS } from './constants';
import { getCurrentDateKey, getCurrentWeekKey, getWeekUtcRange } from './dateKeys';

export interface QuizActivityInput {
    activityId: string;
    quizId: string;
    studentId?: string;
    classId?: string | null;
    category: string;
    totalQuestions: number;
    correctCount: number;
}

const SUPPORTED_WEEKLY_SUBJECTS = new Set(['toan', 'tieng-viet', 'tieng-anh']);

export const recordQuizActivity = async (
    db: D1Database,
    username: string,
    input: QuizActivityInput
): Promise<boolean> => {
    const existing = await db.prepare(`
        SELECT activity_id
        FROM student_game_activity_events
        WHERE activity_id = ?
        LIMIT 1
    `).bind(input.activityId).first<any>();
    if (existing) return true;

    const dateKey = getCurrentDateKey();
    const weekKey = getCurrentWeekKey();
    const { startIso, endIsoExclusive } = getWeekUtcRange(weekKey);
    const now = new Date().toISOString();
    const isPerfect = input.totalQuestions > 0 && input.correctCount === input.totalQuestions;
    const statements: D1PreparedStatement[] = [
        db.prepare(`
            INSERT INTO student_game_activity_events
            (activity_id, username, event_type, event_date, payload_json, created_at)
            VALUES (?, ?, 'QUIZ_COMPLETED', ?, ?, ?)
        `).bind(
            input.activityId,
            username,
            dateKey,
            JSON.stringify({
                resultId: input.activityId,
                quizId: input.quizId,
                category: input.category,
                correctCount: input.correctCount,
                totalQuestions: input.totalQuestions,
            }),
            now,
        ),
        db.prepare(`
            INSERT INTO student_daily_progress (
                username, progress_date, questions_answered, correct_answers,
                quizzes_completed, toan_quizzes_completed, tieng_viet_quizzes_completed,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
            ON CONFLICT(username, progress_date) DO UPDATE SET
                questions_answered = questions_answered + excluded.questions_answered,
                correct_answers = correct_answers + excluded.correct_answers,
                quizzes_completed = quizzes_completed + 1,
                toan_quizzes_completed = toan_quizzes_completed + excluded.toan_quizzes_completed,
                tieng_viet_quizzes_completed = tieng_viet_quizzes_completed + excluded.tieng_viet_quizzes_completed,
                updated_at = excluded.updated_at
        `).bind(
            username,
            dateKey,
            Math.max(0, Math.floor(input.totalQuestions)),
            Math.max(0, Math.floor(input.correctCount)),
            input.category === 'toan' ? 1 : 0,
            input.category === 'tieng-viet' ? 1 : 0,
            now,
            now,
        ),
    ];

    for (const quest of WEEKLY_QUESTS) {
        statements.push(db.prepare(`
            INSERT OR IGNORE INTO student_weekly_progress
            (username, week_key, quest_id, progress, target, claimed, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, 0, ?, ?)
        `).bind(username, weekKey, quest.id, quest.target, now, now));
    }

    statements.push(
        db.prepare(`
            UPDATE student_weekly_progress
            SET progress = progress + 1, updated_at = ?
            WHERE username = ? AND week_key = ? AND quest_id = 'weekly_20_quizzes'
        `).bind(now, username, weekKey),
        db.prepare(`
            UPDATE student_weekly_progress
            SET progress = progress + ?, updated_at = ?
            WHERE username = ? AND week_key = ? AND quest_id = 'weekly_100_correct'
        `).bind(Math.max(0, Math.floor(input.correctCount)), now, username, weekKey),
        db.prepare(`
            INSERT INTO student_weekly_state (
                username, week_key, current_perfect_streak, max_perfect_streak,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(username, week_key) DO UPDATE SET
                current_perfect_streak = CASE
                    WHEN excluded.current_perfect_streak > 0
                        THEN student_weekly_state.current_perfect_streak + 1
                    ELSE 0
                END,
                max_perfect_streak = MAX(
                    student_weekly_state.max_perfect_streak,
                    CASE
                        WHEN excluded.current_perfect_streak > 0
                            THEN student_weekly_state.current_perfect_streak + 1
                        ELSE 0
                    END
                ),
                updated_at = excluded.updated_at
        `).bind(
            username,
            weekKey,
            isPerfect ? 1 : 0,
            isPerfect ? 1 : 0,
            now,
            now,
        ),
        db.prepare(`
            UPDATE student_weekly_progress
            SET progress = COALESCE((
                    SELECT max_perfect_streak
                    FROM student_weekly_state
                    WHERE username = ? AND week_key = ?
                ), 0),
                updated_at = ?
            WHERE username = ? AND week_key = ? AND quest_id = 'weekly_perfect_streak'
        `).bind(username, weekKey, now, username, weekKey),
    );

    if (SUPPORTED_WEEKLY_SUBJECTS.has(input.category)) {
        statements.push(
            db.prepare(`
                INSERT OR IGNORE INTO student_weekly_subjects
                (username, week_key, subject_key, first_result_id, created_at)
                VALUES (?, ?, ?, ?, ?)
            `).bind(username, weekKey, input.category, input.activityId, now),
            db.prepare(`
                UPDATE student_weekly_progress
                SET progress = MIN(target, COALESCE((
                        SELECT COUNT(*)
                        FROM student_weekly_subjects
                        WHERE username = ? AND week_key = ?
                    ), 0)),
                    updated_at = ?
                WHERE username = ? AND week_key = ? AND quest_id = 'weekly_subject_master'
            `).bind(username, weekKey, now, username, weekKey),
        );
    }

    if (input.studentId && input.classId) {
        statements.push(db.prepare(`
            WITH aggregated AS (
                SELECT student_id,
                       SUM(COALESCE(score, 0)) AS total_score,
                       SUM(COALESCE(correct_count, 0)) AS total_correct,
                       MIN(submitted_at) AS first_submitted_at
                FROM results
                WHERE class_id = ?
                  AND student_id IS NOT NULL
                  AND submitted_at >= ?
                  AND submitted_at < ?
                GROUP BY student_id
            ), ranked AS (
                SELECT student_id,
                       ROW_NUMBER() OVER (
                           ORDER BY total_score DESC,
                                    total_correct DESC,
                                    first_submitted_at ASC,
                                    student_id ASC
                       ) AS rank_position
                FROM aggregated
            )
            UPDATE student_weekly_progress
            SET progress = CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM ranked
                        JOIN students ranked_student ON ranked_student.id = ranked.student_id
                        WHERE ranked_student.username = student_weekly_progress.username
                          AND ranked.rank_position <= 5
                    ) THEN 1 ELSE 0
                END,
                updated_at = ?
            WHERE week_key = ?
              AND quest_id = 'weekly_top_5'
              AND EXISTS (
                  SELECT 1
                  FROM students scoped_student
                  WHERE scoped_student.username = student_weekly_progress.username
                    AND scoped_student.class_id = ?
              )
        `).bind(
            input.classId,
            startIso,
            endIsoExclusive,
            now,
            weekKey,
            input.classId,
        ));
    }

    try {
        await db.batch(statements);
        return false;
    } catch (error) {
        const raced = await db.prepare(`
            SELECT activity_id
            FROM student_game_activity_events
            WHERE activity_id = ?
            LIMIT 1
        `).bind(input.activityId).first<any>();
        if (raced) return true;
        throw error;
    }
};
