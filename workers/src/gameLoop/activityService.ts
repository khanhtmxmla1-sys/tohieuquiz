import { getBangkokDateKey, getCurrentWeekKey } from './dateKeys';
import { getOrCreateDailyProgress } from './progressRepository';
import { updateWeeklyQuestProgress } from './weeklyQuestService';

export interface QuizActivityInput {
    activityId: string;
    quizId: string;
    category: string;
    totalQuestions: number;
    correctCount: number;
}

export const recordQuizActivity = async (
    db: D1Database,
    username: string,
    input: QuizActivityInput
): Promise<void> => {
    const existing = await db.prepare(`
        SELECT activity_id
        FROM student_game_activity_events
        WHERE activity_id = ?
        LIMIT 1
    `).bind(input.activityId).first<any>();
    if (existing) return;

    const dateKey = getBangkokDateKey();
    const now = new Date().toISOString();
    const progress = await getOrCreateDailyProgress(db, username, dateKey);
    await db.batch([
        db.prepare(`
            INSERT INTO student_game_activity_events
            (activity_id, username, event_type, event_date, payload_json, created_at)
            VALUES (?, ?, 'QUIZ_COMPLETED', ?, ?, ?)
        `).bind(
            input.activityId, username, dateKey,
            JSON.stringify({
                quizId: input.quizId, category: input.category,
                correctCount: input.correctCount, totalQuestions: input.totalQuestions,
            }),
            now
        ),
        db.prepare(`
            UPDATE student_daily_progress
            SET questions_answered = ?, correct_answers = ?, quizzes_completed = ?,
                toan_quizzes_completed = ?, tieng_viet_quizzes_completed = ?, updated_at = ?
            WHERE username = ? AND progress_date = ?
        `).bind(
            Number(progress.questions_answered) + input.totalQuestions,
            Number(progress.correct_answers) + input.correctCount,
            Number(progress.quizzes_completed) + 1,
            Number(progress.toan_quizzes_completed) + (input.category === 'toan' ? 1 : 0),
            Number(progress.tieng_viet_quizzes_completed) + (input.category === 'tieng-viet' ? 1 : 0),
            now, username, dateKey
        ),
    ]);

    const weeklyUpdates: Record<string, number> = {
        weekly_20_quizzes: 1,
        weekly_100_correct: input.correctCount,
    };
    if (input.correctCount === input.totalQuestions && input.totalQuestions > 0) {
        weeklyUpdates.weekly_perfect_streak = 1;
    }
    await updateWeeklyQuestProgress(db, username, getCurrentWeekKey(), weeklyUpdates);
};
